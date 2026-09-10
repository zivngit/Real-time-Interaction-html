import json
import socket
import threading
import time

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient

import server.main as m


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(m, "ACCESS_KEY", "")
    m._rate_window.clear()
    with TestClient(m.app) as tc:
        yield tc


@pytest.fixture()
def live_server():
    m._rate_window.clear()
    port = _free_port()
    config = uvicorn.Config("server.main:app", host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    deadline = time.time() + 15
    up = False
    while time.time() < deadline:
        try:
            r = httpx.get(f"http://127.0.0.1:{port}/health", timeout=1)
            if r.status_code == 200:
                up = True
                break
        except httpx.HTTPError:
            time.sleep(0.1)
    if not up:
        pytest.fail("server did not start")
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    t.join(timeout=5)


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_effects_list(client):
    r = client.get("/api/effects")
    assert r.status_code == 200
    names = set(r.json()["effects"].keys())
    assert names == {"particle", "ripple", "firework", "text"}


def test_effect_ok(client):
    r = client.post("/api/effect", json={"effect": "particle", "x": 50, "y": 50, "params": {"color": "#fff"}})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["id"]


def test_effect_unknown(client):
    r = client.post("/api/effect", json={"effect": "nope", "x": 50, "y": 50})
    assert r.status_code == 400


def test_effect_bad_coords(client):
    r = client.post("/api/effect", json={"effect": "particle", "x": 101, "y": 50})
    assert r.status_code == 422


def test_clear(client):
    r = client.post("/api/clear")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_serves_viewer_app_js(client):
    r = client.get("/viewer/app.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    assert "EventSource" in r.text


def test_serves_viewer_effects_js(client):
    r = client.get("/viewer/effects.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    assert "createEffect" in r.text


def test_serves_console_app_js(client):
    r = client.get("/console/app.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    assert "rtx-console" in r.text


def test_serves_console_style_css(client):
    r = client.get("/console/style.css")
    assert r.status_code == 200
    assert "css" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    assert "#rtx-fab" in r.text


def test_serves_console_icons_js(client):
    r = client.get("/console/icons.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    assert "RTX_EFFECT_ICONS" in r.text
    assert "RTX_UI_ICONS" in r.text


def test_legacy_asset_routes_removed(client):
    for route in ("/app.js", "/effects.js", "/console.js", "/icons.js", "/console.css"):
        assert client.get(route).status_code == 404


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(m, "RATE_LIMIT_PER_SEC", 3)
    m._rate_window.clear()
    for _ in range(3):
        assert client.post("/api/effect", json={"effect": "ripple", "x": 1, "y": 1}).status_code == 200
    r = client.post("/api/effect", json={"effect": "ripple", "x": 1, "y": 1})
    assert r.status_code == 429
    assert r.headers["retry-after"] == "1"


def test_access_key_enforced(client, monkeypatch):
    monkeypatch.setattr(m, "ACCESS_KEY", "secret")
    assert client.post("/api/effect", json={"effect": "ripple", "x": 1, "y": 1}).status_code == 401
    assert client.get("/api/stream").status_code == 401
    assert client.post("/api/clear").status_code == 401
    ok = client.post(
        "/api/effect",
        json={"effect": "ripple", "x": 1, "y": 1},
        headers={"X-Access-Key": "secret"},
    )
    assert ok.status_code == 200
    ok2 = client.post("/api/effect", json={"effect": "ripple", "x": 1, "y": 1}, params={"key": "secret"})
    assert ok2.status_code == 200


def test_sse_receives_effect_and_clear(live_server):
    base = live_server
    events = []
    seen = set()

    def reader():
        with httpx.stream("GET", f"{base}/api/stream", timeout=httpx.Timeout(30, connect=5)) as r:
            assert r.status_code == 200
            event_type = None
            for line in r.iter_lines():
                if line.startswith("event: "):
                    event_type = line[7:].strip()
                elif line.startswith("data: ") and event_type:
                    data = json.loads(line[6:])
                    if event_type in ("effect", "clear"):
                        seen.add(event_type)
                        events.append((event_type, data))
                    if seen >= {"effect", "clear"}:
                        break

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    time.sleep(1.0)
    r = httpx.post(
        f"{base}/api/effect",
        json={"effect": "particle", "x": 42.5, "y": 63.0, "params": {"color": "#ff0044"}},
        timeout=5,
    )
    assert r.status_code == 200
    httpx.post(f"{base}/api/clear", timeout=5)
    t.join(timeout=15)
    assert not t.is_alive(), "SSE reader did not finish in time"
    types = [e[0] for e in events]
    assert "effect" in types
    assert "clear" in types
    ev = next(e for e in events if e[0] == "effect")
    assert ev[1]["effect"] == "particle"
    assert ev[1]["x"] == 42.5
    assert ev[1]["y"] == 63.0
    assert ev[1]["params"] == {"color": "#ff0044"}
    assert ev[1]["id"]
    time.sleep(1.0)
    assert len(m._subscribers) == 0


def test_sse_access_key(live_server, monkeypatch):
    base = live_server
    monkeypatch.setattr(m, "ACCESS_KEY", "k123")
    assert httpx.get(f"{base}/api/stream", timeout=5).status_code == 401
    with httpx.stream("GET", f"{base}/api/stream?key=k123", timeout=httpx.Timeout(10, connect=5)) as r:
        assert r.status_code == 200
        first = next(r.iter_lines())
    assert first.startswith("retry:")


def test_examples_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("SERVE_EXAMPLES", raising=False)
    for route in (
        "/examples",
        "/examples/",
        "/examples/index.html",
        "/examples/embed-viewer.html",
        "/examples/embed-console.html",
        "/examples/embed-both.html",
    ):
        assert client.get(route).status_code == 404


def test_examples_enabled_when_serve_examples_set(client, monkeypatch):
    monkeypatch.setenv("SERVE_EXAMPLES", "1")
    r = client.get("/examples/index.html")
    assert r.status_code == 200
    assert "html" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    for name in ("embed-viewer.html", "embed-console.html", "embed-both.html"):
        assert name in r.text
    assert "/viewer/index.html" not in r.text
    assert "/console/index.html" not in r.text
    r = client.get("/examples/embed-viewer.html")
    assert r.status_code == 200
    assert "/viewer/app.js" in r.text
    r = client.get("/examples/embed-console.html")
    assert r.status_code == 200
    for asset in ("/console/style.css", "/console/icons.js", "/console/app.js"):
        assert asset in r.text
    r = client.get("/examples/embed-both.html")
    assert r.status_code == 200
    assert "/viewer/app.js" in r.text
    assert "/console/app.js" in r.text
