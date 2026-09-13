import copy
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

import server.effects
import server.main as m
import server.relay as relay

EFFECTS_V2 = Path(__file__).resolve().parent / "fixtures" / "effects-v2.json"


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(m, "ACCESS_KEY", "")
    m.rate_limiter.reset()
    m.reload_limiter.reset()
    with TestClient(m.app) as tc:
        yield tc


@pytest.fixture()
def live_server():
    m.rate_limiter.reset()
    m.reload_limiter.reset()
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


@pytest.fixture()
def reload_catalog(tmp_path, monkeypatch):
    fixture_manifest = Path(__file__).resolve().parent / "fixtures" / "effects.json"
    initial_raw = json.loads(fixture_manifest.read_text(encoding="utf-8"))

    initial_path = tmp_path / "initial.json"
    initial_path.write_text(json.dumps(initial_raw), encoding="utf-8")

    reloaded_raw = copy.deepcopy(initial_raw)
    reloaded_raw["effects"]["particle"]["label"] = "Reloaded Particle"
    reloaded_raw["effects"]["particle"]["params"]["count"]["default"] = 55
    reloaded_path = tmp_path / "reloaded.json"
    reloaded_path.write_text(json.dumps(reloaded_raw), encoding="utf-8")

    invalid_path = tmp_path / "invalid.json"
    invalid_path.write_text("{", encoding="utf-8")

    missing_raw = copy.deepcopy(initial_raw)
    missing_raw["effects"]["missing"] = {
        "label": "Missing",
        "viewer": "viewer.js",
        "params": {},
    }
    missing_path = tmp_path / "missing.json"
    missing_path.write_text(json.dumps(missing_raw), encoding="utf-8")

    monkeypatch.setattr(server.effects, "MANIFEST_PATH", initial_path)
    old_manifest = copy.deepcopy(server.effects.MANIFEST)
    old_effects = copy.deepcopy(server.effects.EFFECTS)
    old_rev = server.effects.MANIFEST_REV
    old_version = server.effects.MANIFEST_VERSION
    old_current = server.effects.MANIFEST_CURRENT_EFFECTS[:]
    old_alternate = server.effects.MANIFEST_ALTERNATE_EFFECTS[:]
    server.effects.reload_effects()

    yield {
        "initial": initial_path,
        "reloaded": reloaded_path,
        "invalid": invalid_path,
        "missing": missing_path,
        "use": lambda path: monkeypatch.setattr(server.effects, "MANIFEST_PATH", Path(path)),
    }

    server.effects.MANIFEST.clear()
    server.effects.MANIFEST.update(old_manifest)
    server.effects.EFFECTS.clear()
    server.effects.EFFECTS.update(old_effects)
    server.effects.MANIFEST_REV = old_rev
    server.effects.MANIFEST_VERSION = old_version
    server.effects.MANIFEST_CURRENT_EFFECTS = old_current
    server.effects.MANIFEST_ALTERNATE_EFFECTS = old_alternate


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


def test_effects_list_includes_rev(client):
    r = client.get("/api/effects")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["rev"], str)
    assert body["rev"]


def test_effects_list_includes_v1_layout(client):
    r = client.get("/api/effects")
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == 1
    assert body["currentEffects"] == ["particle", "ripple", "firework", "text"]
    assert body["alternateEffects"] == []


def test_reload_v2_exposes_layout_and_excludes_disabled(client, reload_catalog):
    reload_catalog["use"](EFFECTS_V2)
    r = client.post("/api/effects/reload")
    assert r.status_code == 200
    assert r.json()["changed"] is True
    body = client.get("/api/effects").json()
    assert body["version"] == 2
    assert body["currentEffects"] == ["particle", "ripple"]
    assert body["alternateEffects"] == ["firework", "text"]
    assert set(body["effects"]) == {"particle", "ripple", "firework", "text"}
    assert "legacy" not in body["effects"]


def test_reload_v2_appends_enabled_effect_omitted_from_layout(client, reload_catalog, tmp_path):
    raw = json.loads(EFFECTS_V2.read_text(encoding="utf-8"))
    raw["alternateEffects"] = ["firework"]
    path = tmp_path / "v2-omitted.json"
    path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    reload_catalog["use"](path)
    r = client.post("/api/effects/reload")
    assert r.status_code == 200
    body = client.get("/api/effects").json()
    assert body["currentEffects"] == ["particle", "ripple"]
    assert body["alternateEffects"] == ["firework", "text"]


def test_reload_invalid_v2_layout_preserves_old_catalog(client, reload_catalog, tmp_path):
    before = client.get("/api/effects").json()
    raw = json.loads(EFFECTS_V2.read_text(encoding="utf-8"))
    raw["currentEffects"] = ["particle", "missing"]
    path = tmp_path / "v2-invalid.json"
    path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    reload_catalog["use"](path)
    r = client.post("/api/effects/reload")
    assert r.status_code == 400
    after = client.get("/api/effects").json()
    assert after["rev"] == before["rev"]
    assert after["version"] == 1
    assert set(after["effects"]) == {"particle", "ripple", "firework", "text"}


def test_post_effect_rejects_disabled_effect(client, reload_catalog):
    reload_catalog["use"](EFFECTS_V2)
    client.post("/api/effects/reload")
    m.rate_limiter.reset()
    r = client.post("/api/effect", json={"effect": "legacy", "x": 50, "y": 50})
    assert r.status_code == 400


def test_reload_success_updates_rev_and_catalog(client, reload_catalog):
    before = client.get("/api/effects").json()
    reload_catalog["use"](reload_catalog["reloaded"])
    r = client.post("/api/effects/reload")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["changed"] is True
    assert body["rev"] != before["rev"]
    effects = client.get("/api/effects").json()["effects"]
    assert effects["particle"]["label"] == "Reloaded Particle"
    assert effects["particle"]["params"]["count"]["default"] == 55
    assert set(body["effects"]) == set(effects.keys())


def test_reload_no_change_returns_same_rev(client, reload_catalog):
    first = client.post("/api/effects/reload").json()
    m.reload_limiter.reset()
    second = client.post("/api/effects/reload").json()
    assert first["changed"] is False
    assert second["changed"] is False
    assert first["rev"] == second["rev"]


def test_reload_invalid_manifest_preserves_old_catalog(client, reload_catalog):
    before = client.get("/api/effects").json()
    reload_catalog["use"](reload_catalog["invalid"])
    r = client.post("/api/effects/reload")
    assert r.status_code == 400
    after = client.get("/api/effects").json()
    assert after["rev"] == before["rev"]
    assert after["effects"]["particle"]["label"] != "Reloaded Particle"


def test_reload_missing_viewer_file_preserves_old_catalog(client, reload_catalog):
    before = client.get("/api/effects").json()
    reload_catalog["use"](reload_catalog["missing"])
    r = client.post("/api/effects/reload")
    assert r.status_code == 400
    after = client.get("/api/effects").json()
    assert after["rev"] == before["rev"]
    assert "missing" not in after["effects"]


def test_reload_requires_access_key(client, reload_catalog, monkeypatch):
    monkeypatch.setattr(m, "ACCESS_KEY", "secret")
    m.reload_limiter.reset()
    assert client.post("/api/effects/reload").status_code == 401
    m.reload_limiter.reset()
    assert client.post("/api/effects/reload", headers={"X-Access-Key": "secret"}).status_code == 200
    m.reload_limiter.reset()
    assert client.post("/api/effects/reload", params={"key": "secret"}).status_code == 401
    m.reload_limiter.reset()
    assert (
        client.post(
            "/api/effects/reload",
            headers={"X-Access-Key": "secret"},
            params={"key": "wrong"},
        ).status_code
        == 200
    )


def test_reload_rate_limit(client, reload_catalog):
    m.reload_limiter.reset()
    assert client.post("/api/effects/reload").status_code == 200
    r = client.post("/api/effects/reload")
    assert r.status_code == 429
    assert r.headers["retry-after"] == "1"


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
    monkeypatch.setattr(m, "broadcast", lambda msg: captured.append(msg))
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
    m.rate_limiter.reset()
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
    assert (
        client.post("/api/effect", json={"effect": "ripple", "x": 1, "y": 1}, params={"key": "secret"}).status_code
        == 401
    )
    assert client.post("/api/clear", params={"key": "secret"}).status_code == 401


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
    assert len(relay._subscribers) == 0


def test_sse_access_key(live_server, monkeypatch):
    base = live_server
    monkeypatch.setattr(m, "ACCESS_KEY", "k123")
    assert httpx.get(f"{base}/api/stream", timeout=5).status_code == 401
    with httpx.stream("GET", f"{base}/api/stream?key=k123", timeout=httpx.Timeout(10, connect=5)) as r:
        assert r.status_code == 200
        first = next(r.iter_lines())
    assert first.startswith("retry:")


def test_sse_manifest_broadcast_on_reload(live_server, reload_catalog):
    base = live_server
    m.reload_limiter.reset()
    events = []

    def reader():
        with httpx.stream("GET", f"{base}/api/stream", timeout=httpx.Timeout(30, connect=5)) as r:
            assert r.status_code == 200
            event_type = None
            for line in r.iter_lines():
                if line.startswith("event: "):
                    event_type = line[7:].strip()
                elif line.startswith("data: ") and event_type:
                    data = json.loads(line[6:])
                    if event_type == "manifest":
                        events.append(data)
                        break

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    time.sleep(1.0)
    reload_catalog["use"](reload_catalog["reloaded"])
    r = httpx.post(f"{base}/api/effects/reload", timeout=5)
    assert r.status_code == 200
    t.join(timeout=15)
    assert not t.is_alive(), "SSE manifest reader did not finish in time"
    assert events
    assert events[0]["rev"] == r.json()["rev"]
    assert events[0]["effects"]["particle"]["label"] == "Reloaded Particle"


def test_examples_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("SERVE_EXAMPLES", raising=False)
    for route in (
        "/examples",
        "/examples/",
        "/examples/index.html",
        "/examples/embed-viewer.html",
        "/examples/embed-console.html",
        "/examples/embed-both.html",
        "/examples/theme.css",
        "/examples/theme.js",
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
    for theme_asset in ("/examples/theme.css", "/examples/theme.js"):
        assert theme_asset in r.text
        assert client.get(theme_asset).status_code == 200
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
