import json
import os
import socket
import threading
import time
from pathlib import Path

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient

os.environ["RTX_EFFECTS_MANIFEST"] = str(Path(__file__).resolve().parent / "fixtures" / "effects.json")

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


def test_effects_list_sanitized_metadata(client):
    r = client.get("/api/effects")
    assert r.status_code == 200
    effects = r.json()["effects"]
    particle = effects["particle"]
    assert particle["label"] == "粒子爆散"
    assert particle["category"] == "burst"
    assert particle["icon"] == "particle"
    assert particle["viewerUrl"] == "/effects/particle/viewer.js"
    assert particle["consoleUrl"] == "/effects/particle/console.js"
    count = particle["params"]["count"]
    assert count == {"type": "integer", "label": "數量", "default": 40, "min": 1, "max": 400, "step": 1}
    firework = effects["firework"]
    assert firework["viewerUrl"] == "/effects/firework/viewer.js"
    assert firework["consoleUrl"] is None
    assert firework["params"]["colors"]["editable"] is False
    assert "name" not in particle
    assert "viewer" not in particle


def test_serves_effects_manifest_json(client):
    r = client.get("/effects/effects.json")
    assert r.status_code == 200
    assert "json" in r.headers["content-type"]
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["version"] == 1
    assert set(body["effects"].keys()) == {"particle", "ripple", "firework", "text"}


def test_serves_effect_viewer_js(client):
    for effect_id in ("particle", "ripple", "firework", "text"):
        r = client.get(f"/effects/{effect_id}/viewer.js")
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        assert r.headers["cache-control"] == "no-store"
        assert "register" in r.text


def test_serves_effect_console_js_when_present(client):
    for effect_id in ("particle", "ripple", "text"):
        r = client.get(f"/effects/{effect_id}/console.js")
        assert r.status_code == 200
        assert "javascript" in r.headers["content-type"]
        assert r.headers["cache-control"] == "no-store"
        assert "RTX_EFFECT_CONSOLE" in r.text


def test_missing_effect_console_js_is_404(client):
    assert client.get("/effects/firework/console.js").status_code == 404


def test_effect_asset_path_traversal_rejected(client):
    for route in (
        "/effects/..",
        "/effects/..%2F..%2Fserver%2Fmain.py",
        "/effects/..%2Fserver%2Fmain.py/viewer.js",
        "/effects/particle/../viewer/app.js",
        "/effects/particle%2Fviewer.js/viewer.js",
        "/effects/particle/other.js",
    ):
        assert client.get(route).status_code == 404, route


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


@pytest.fixture()
def capture_broadcast(client, monkeypatch):
    captured = []
    monkeypatch.setattr(m, "_broadcast", lambda msg: captured.append(msg))
    return captured


def test_effect_params_fill_defaults(client, capture_broadcast):
    r = client.post("/api/effect", json={"effect": "particle", "x": 50, "y": 50})
    assert r.status_code == 200
    assert capture_broadcast[0]["params"] == {
        "color": "#ff0044",
        "count": 40,
        "spread": 360,
        "speed": 0.35,
        "duration": 1200,
    }


def test_effect_params_clamp_number(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "particle", "x": 50, "y": 50, "params": {"spread": 999, "speed": 0.01}},
    )
    assert r.status_code == 200
    p = capture_broadcast[0]["params"]
    assert p["spread"] == 360
    assert p["speed"] == 0.05


def test_effect_params_integer_round_and_clamp(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "particle", "x": 50, "y": 50, "params": {"count": 40.6, "duration": 5.5}},
    )
    assert r.status_code == 200
    p = capture_broadcast[0]["params"]
    assert p["count"] == 41
    assert isinstance(p["count"], int)
    assert p["duration"] == 200


def test_effect_params_invalid_color_falls_back(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "particle", "x": 50, "y": 50, "params": {"color": "not-a-color"}},
    )
    assert r.status_code == 200
    assert capture_broadcast[0]["params"]["color"] == "#ff0044"
    client.post(
        "/api/effect",
        json={"effect": "particle", "x": 50, "y": 50, "params": {"color": "#12345678"}},
    )
    assert capture_broadcast[1]["params"]["color"] == "#12345678"


def test_effect_params_unknown_ignored(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "particle", "x": 50, "y": 50, "params": {"bogus": 1, "count": 10}},
    )
    assert r.status_code == 200
    p = capture_broadcast[0]["params"]
    assert "bogus" not in p
    assert p["count"] == 10


def test_effect_params_editable_false_uses_default(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "firework", "x": 50, "y": 50, "params": {"colors": ["#111111"], "count": 5}},
    )
    assert r.status_code == 200
    p = capture_broadcast[0]["params"]
    assert p["colors"] == ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"]
    assert p["count"] == 5


def test_effect_params_string_max_length_truncated(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "text", "x": 50, "y": 50, "params": {"content": "a" * 30}},
    )
    assert r.status_code == 200
    assert capture_broadcast[0]["params"]["content"] == "a" * 20


def test_effect_params_non_string_falls_back(client, capture_broadcast):
    r = client.post(
        "/api/effect",
        json={"effect": "text", "x": 50, "y": 50, "params": {"content": 123}},
    )
    assert r.status_code == 200
    assert capture_broadcast[0]["params"]["content"] == "Hello"


def test_effect_params_boolean_and_select_fallback(client, monkeypatch, capture_broadcast):
    synthetic = dict(m.EFFECTS)
    synthetic["synth"] = {
        "label": "synth",
        "viewerUrl": "/effects/synth/viewer.js",
        "consoleUrl": None,
        "params": {
            "flag": {"type": "boolean", "label": "flag", "default": True},
            "mode": {
                "type": "select",
                "label": "mode",
                "default": "a",
                "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}],
            },
        },
    }
    monkeypatch.setattr(m, "EFFECTS", synthetic)
    assert client.post(
        "/api/effect", json={"effect": "synth", "x": 50, "y": 50, "params": {"flag": "yes", "mode": "b"}}
    ).status_code == 200
    assert client.post(
        "/api/effect", json={"effect": "synth", "x": 50, "y": 50, "params": {"flag": False, "mode": "nope"}}
    ).status_code == 200
    assert capture_broadcast[0]["params"] == {"flag": True, "mode": "b"}
    assert capture_broadcast[1]["params"] == {"flag": False, "mode": "a"}


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
    assert ev[1]["params"] == {
        "color": "#ff0044",
        "count": 40,
        "spread": 360,
        "speed": 0.35,
        "duration": 1200,
    }
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
