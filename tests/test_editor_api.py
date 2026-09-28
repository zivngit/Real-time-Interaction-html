"""API tests for the effects editor endpoints (server/editor.py)."""

import io
import json
import logging
import os
import re
import shutil
import zipfile
from copy import deepcopy
from pathlib import Path

import pytest

import server.editor as ed
import server.effects as fx
import server.main as m
from fastapi.testclient import TestClient

os.environ.setdefault(
    "RTX_EFFECTS_MANIFEST",
    str(Path(__file__).resolve().parent.parent / "effects" / "effects.json"),
)

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_EFFECTS_DIR = ROOT / "tests" / "fixtures"
FIXTURE_V1 = Path(__file__).resolve().parent / "fixtures" / "effects.json"
FIXTURE_V2 = Path(__file__).resolve().parent / "fixtures" / "effects-v2.json"

EDITOR_EFFECTS = ("particle", "ripple", "firework", "text")


def _snapshot() -> dict:
    return {
        "manifest": deepcopy(fx.MANIFEST),
        "effects": deepcopy(fx.EFFECTS),
        "rev": fx.MANIFEST_REV,
        "version": fx.MANIFEST_VERSION,
        "current": list(fx.MANIFEST_CURRENT_EFFECTS),
        "alternate": list(fx.MANIFEST_ALTERNATE_EFFECTS),
    }


def _restore(old: dict) -> None:
    fx.MANIFEST.clear()
    fx.MANIFEST.update(old["manifest"])
    fx.EFFECTS.clear()
    fx.EFFECTS.update(old["effects"])
    fx.MANIFEST_REV = old["rev"]
    fx.MANIFEST_VERSION = old["version"]
    fx.MANIFEST_CURRENT_EFFECTS = old["current"]
    fx.MANIFEST_ALTERNATE_EFFECTS = old["alternate"]


@pytest.fixture()
def editor_env(tmp_path, monkeypatch):
    env_dir = tmp_path / "effects"
    env_dir.mkdir()
    manifest_path = env_dir / "effects.json"
    manifest_path.write_text(
        json.dumps(json.loads(FIXTURE_V2.read_text(encoding="utf-8")), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    for effect_id in EDITOR_EFFECTS:
        src = FIXTURE_EFFECTS_DIR / effect_id
        if src.is_dir():
            shutil.copytree(src, env_dir / effect_id)

    monkeypatch.setattr(fx, "MANIFEST_PATH", manifest_path)
    monkeypatch.setattr(fx, "EFFECTS_DIR", env_dir)
    old = _snapshot()
    fx.reload_effects()
    yield {"env_dir": env_dir, "manifest_path": manifest_path}
    _restore(old)


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "")
    ed.editor_limiter.reset()
    with TestClient(m.app) as tc:
        yield tc


@pytest.fixture()
def broadcast_captured(monkeypatch):
    captured: list[dict] = []
    monkeypatch.setattr(ed, "broadcast", lambda msg: captured.append(msg))
    return captured


def _current_manifest() -> dict:
    return deepcopy(fx.MANIFEST)


def _written_manifest(env: dict) -> dict:
    return json.loads(env["manifest_path"].read_text(encoding="utf-8"))


def _zip_names(data: bytes) -> set[str]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        return set(archive.namelist())


def _build_zip(manifest: dict, files: dict[str, str] | None = None) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("effects.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        for name, content in (files or {}).items():
            archive.writestr(name, content)
    return buffer.getvalue()


def _import(client: TestClient, data: bytes, key: str | None = None) -> "TestClient":
    headers = {"X-Access-Key": key} if key else {}
    return client.post(
        "/api/editor/import",
        files={"file": ("effects.zip", io.BytesIO(data), "application/zip")},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# GET /api/editor/manifest
# ---------------------------------------------------------------------------


def test_get_manifest_returns_raw_and_rev(client, editor_env):
    r = client.get("/api/editor/manifest")
    assert r.status_code == 200
    body = r.json()
    assert body["rev"] == fx.MANIFEST_REV
    assert body["manifest"] == fx.MANIFEST
    assert body["manifest"]["version"] == 2
    assert body["manifest"]["currentEffects"] == ["particle", "ripple"]
    assert body["manifest"]["alternateEffects"] == ["firework", "text"]
    assert "legacy" in body["manifest"]["effects"]


def test_get_manifest_no_key_required(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.get("/api/editor/manifest").status_code == 200


# ---------------------------------------------------------------------------
# PUT /api/editor/manifest
# ---------------------------------------------------------------------------


def test_put_manifest_updates_catalog(client, editor_env, broadcast_captured):
    old_rev = fx.MANIFEST_REV
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["particle"]["label"] = "Editor Label"
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["changed"] is True
    assert data["rev"] != old_rev
    assert data["created"] == []
    assert "particle" in data["effects"]
    assert _written_manifest(editor_env)["effects"]["particle"]["label"] == "Editor Label"
    assert fx.EFFECTS["particle"]["label"] == "Editor Label"
    assert broadcast_captured and broadcast_captured[-1]["type"] == "manifest"


def test_put_manifest_no_change(client, editor_env, broadcast_captured):
    r = client.put("/api/editor/manifest", json={"manifest": _current_manifest()})
    assert r.status_code == 200
    assert r.json()["changed"] is False
    assert broadcast_captured == []
    assert not (editor_env["env_dir"] / ".backup").exists()


def test_put_manifest_baseRev_mismatch(client, editor_env):
    before = fx.MANIFEST_REV
    r = client.put(
        "/api/editor/manifest",
        json={"manifest": _current_manifest(), "baseRev": "bogus"},
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "baseRev mismatch"
    assert fx.MANIFEST_REV == before


def test_put_manifest_baseRev_match(client, editor_env):
    r = client.put(
        "/api/editor/manifest",
        json={"manifest": _current_manifest(), "baseRev": fx.MANIFEST_REV},
    )
    assert r.status_code == 200


def test_put_manifest_version_not_2(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["manifest"]["version"] = 1
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 400


def test_put_manifest_requires_non_empty_effects(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"] = {}
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 400


def test_put_manifest_on_v1_is_read_only(client, editor_env, monkeypatch):
    v1_path = editor_env["env_dir"] / "v1.json"
    v1_path.write_text(json.dumps(json.loads(FIXTURE_V1.read_text(encoding="utf-8"))), encoding="utf-8")
    monkeypatch.setattr(fx, "MANIFEST_PATH", v1_path)
    fx.reload_effects()
    assert fx.MANIFEST_VERSION == 1
    r = client.put("/api/editor/manifest", json={"manifest": _current_manifest()})
    assert r.status_code == 400
    assert r.json()["detail"] == "v1 manifest is read-only"


def test_put_manifest_creates_new_effect_with_templates(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["spark"] = {
        "label": "火花",
        "category": "burst",
        "icon": "spark",
        "viewer": "viewer.js",
        "console": "console.js",
        "params": {},
    }
    body["manifest"]["currentEffects"].append("spark")
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == ["spark"]
    assert "spark" in data["effects"]
    spark_dir = editor_env["env_dir"] / "spark"
    viewer = (spark_dir / "viewer.js").read_text(encoding="utf-8")
    console = (spark_dir / "console.js").read_text(encoding="utf-8")
    assert "window.Effects.register(" in viewer
    assert 'register("spark"' in viewer
    assert "window.RTX_EFFECT_CONSOLE.register(" in console
    assert "spark" in fx.EFFECTS
    backups = [p for p in (editor_env["env_dir"] / ".backup").iterdir() if p.is_dir()]
    assert len(backups) == 1
    assert (backups[0] / "effects.json").is_file()
    assert not (backups[0] / "spark").exists()


def test_put_manifest_invalid_new_effect_id(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["bad id"] = {"label": "Bad", "params": {}}
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 400
    assert "invalid effect id" in r.json()["detail"]
    assert not (editor_env["env_dir"] / "bad id").exists()


def test_put_manifest_invalid_manifest_rolls_back(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["broken"] = {
        "label": "Broken",
        "viewer": "missing.js",
        "params": {},
    }
    body["manifest"]["currentEffects"].append("broken")
    before_manifest = editor_env["manifest_path"].read_text(encoding="utf-8")
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 400
    assert "missing viewer file" in r.json()["detail"]
    assert not (editor_env["env_dir"] / "broken").exists()
    assert editor_env["manifest_path"].read_text(encoding="utf-8") == before_manifest
    assert "broken" not in fx.EFFECTS


def test_put_manifest_delete_removed(client, editor_env):
    body = {"manifest": _current_manifest()}
    del body["manifest"]["effects"]["text"]
    body["manifest"]["alternateEffects"] = [i for i in body["manifest"]["alternateEffects"] if i != "text"]
    r = client.put("/api/editor/manifest", json={**body, "deleteRemoved": True})
    assert r.status_code == 200
    assert not (editor_env["env_dir"] / "text").exists()
    assert (editor_env["env_dir"] / "ripple").exists()


def test_put_manifest_delete_removed_list_only_named(client, editor_env):
    body = {"manifest": _current_manifest()}
    del body["manifest"]["effects"]["text"]
    del body["manifest"]["effects"]["ripple"]
    body["manifest"]["currentEffects"] = [
        i for i in body["manifest"]["currentEffects"] if i not in ("text", "ripple")
    ]
    body["manifest"]["alternateEffects"] = [
        i for i in body["manifest"]["alternateEffects"] if i not in ("text", "ripple")
    ]
    r = client.put("/api/editor/manifest", json={**body, "deleteRemoved": ["text"]})
    assert r.status_code == 200
    assert not (editor_env["env_dir"] / "text").exists()
    assert (editor_env["env_dir"] / "ripple").exists()
    assert "text" not in _written_manifest(editor_env)["effects"]
    assert "ripple" not in _written_manifest(editor_env)["effects"]


def test_put_manifest_delete_removed_list_ignores_non_removed(client, editor_env):
    body = {"manifest": _current_manifest()}
    del body["manifest"]["effects"]["text"]
    body["manifest"]["alternateEffects"] = [
        i for i in body["manifest"]["alternateEffects"] if i != "text"
    ]
    r = client.put(
        "/api/editor/manifest",
        json={**body, "deleteRemoved": ["particle", "ghost"]},
    )
    assert r.status_code == 200
    assert (editor_env["env_dir"] / "particle").exists()
    assert (editor_env["env_dir"] / "text").exists()
    assert _written_manifest(editor_env)["effects"]["particle"]["label"]


def test_put_manifest_keeps_removed_directory_by_default(client, editor_env):
    body = {"manifest": _current_manifest()}
    del body["manifest"]["effects"]["text"]
    body["manifest"]["alternateEffects"] = [i for i in body["manifest"]["alternateEffects"] if i != "text"]
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 200
    assert (editor_env["env_dir"] / "text").exists()
    assert "text" not in _written_manifest(editor_env)["effects"]


def test_put_manifest_backup_retention(client, editor_env):
    for i in range(6):
        ed.editor_limiter.reset()
        body = {"manifest": _current_manifest()}
        body["manifest"]["effects"]["particle"]["label"] = f"Run {i}"
        r = client.put("/api/editor/manifest", json=body)
        assert r.status_code == 200
    backup_dir = editor_env["env_dir"] / ".backup"
    backups = [p for p in backup_dir.iterdir() if p.is_dir()]
    assert len(backups) == 5
    for backup in backups:
        assert (backup / "effects.json").is_file()


def test_put_manifest_requires_key(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.put("/api/editor/manifest", json={"manifest": _current_manifest()}).status_code == 401
    ed.editor_limiter.reset()
    r = client.put(
        "/api/editor/manifest",
        json={"manifest": _current_manifest()},
        headers={"X-Access-Key": "secret"},
    )
    assert r.status_code == 200


def test_put_manifest_rate_limited(client, editor_env):
    assert client.put("/api/editor/manifest", json={"manifest": _current_manifest()}).status_code == 200
    assert client.put("/api/editor/manifest", json={"manifest": _current_manifest()}).status_code == 429


# ---------------------------------------------------------------------------
# DELETE /api/editor/effect/{effect_id}
# ---------------------------------------------------------------------------


def test_delete_effect_removes_from_manifest(client, editor_env, broadcast_captured):
    old_rev = fx.MANIFEST_REV
    r = client.delete("/api/editor/effect/text")
    assert r.status_code == 200
    data = r.json()
    assert data["created"] == []
    assert data["changed"] is True
    assert data["rev"] != old_rev
    manifest = _written_manifest(editor_env)
    assert "text" not in manifest["effects"]
    assert "text" not in manifest["alternateEffects"]
    assert (editor_env["env_dir"] / "text").exists()
    assert "text" not in fx.EFFECTS
    assert broadcast_captured and broadcast_captured[-1]["type"] == "manifest"


def test_delete_effect_with_files(client, editor_env):
    r = client.delete("/api/editor/effect/text?deleteFiles=true")
    assert r.status_code == 200
    assert not (editor_env["env_dir"] / "text").exists()
    assert "text" not in _written_manifest(editor_env)["effects"]


def test_delete_effect_unknown(client, editor_env):
    r = client.delete("/api/editor/effect/ghost")
    assert r.status_code == 400
    assert "unknown effect" in r.json()["detail"]


def test_delete_effect_invalid_id(client, editor_env):
    assert client.delete("/api/editor/effect/bad%20id").status_code == 404


def test_delete_effect_on_v1_is_read_only(client, editor_env, monkeypatch):
    v1_path = editor_env["env_dir"] / "v1.json"
    v1_path.write_text(json.dumps(json.loads(FIXTURE_V1.read_text(encoding="utf-8"))), encoding="utf-8")
    monkeypatch.setattr(fx, "MANIFEST_PATH", v1_path)
    fx.reload_effects()
    assert fx.MANIFEST_VERSION == 1
    assert client.delete("/api/editor/effect/text").status_code == 400


def test_delete_effect_requires_key(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.delete("/api/editor/effect/text").status_code == 401
    ed.editor_limiter.reset()
    assert client.delete(
        "/api/editor/effect/text", headers={"X-Access-Key": "secret"}
    ).status_code == 200


def test_delete_effect_rate_limited(client, editor_env):
    assert client.delete("/api/editor/effect/text").status_code == 200
    assert client.delete("/api/editor/effect/ripple").status_code == 429


# ---------------------------------------------------------------------------
# GET/PUT/DELETE effect files
# ---------------------------------------------------------------------------


def test_get_viewer_file_raw(client, editor_env):
    r = client.get("/api/editor/effect/particle/viewer.js")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.text == (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8")


def test_get_file_missing(client, editor_env):
    assert client.get("/api/editor/effect/ghost/viewer.js").status_code == 404
    assert client.get("/api/editor/effect/firework/console.js").status_code == 404


def test_get_file_no_key_required(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.get("/api/editor/effect/particle/viewer.js").status_code == 200


def test_get_template_endpoint(client, editor_env):
    # viewer 模板：__ID__ 置換為 effect id
    r = client.get("/api/editor/effect/particle/viewer.js?template=true")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert 'window.Effects.register("particle"' in r.text
    assert "__ID__" not in r.text
    # 尚無檔案的特效（ghost）→ 仍回傳模板（非 404）
    r2 = client.get("/api/editor/effect/ghost/viewer.js?template=true")
    assert r2.status_code == 200
    assert 'window.Effects.register("ghost"' in r2.text
    # console 模板
    r3 = client.get("/api/editor/effect/ripple/console.js?template=true")
    assert r3.status_code == 200
    assert 'window.RTX_EFFECT_CONSOLE.register("ripple"' in r3.text
    # 模板不落盤（ghost 目錄不建立）
    assert not (editor_env["env_dir"] / "ghost").exists()
    # invalid id → 404
    assert client.get("/api/editor/effect/bad%20id/viewer.js?template=true").status_code == 404


def test_get_template_no_key_required(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.get("/api/editor/effect/particle/viewer.js?template=true").status_code == 200


def test_put_viewer_file(client, editor_env, broadcast_captured):
    old_rev = fx.MANIFEST_REV
    new_content = (
        '(function(){ "use strict";\n'
        "if (typeof window === \"undefined\" || !window.Effects) return;\n"
        'window.Effects.register("particle", function (px, py, params) {\n'
        "  return { update: function () {}, done: function () { return true; }, draw: function () {} };\n"
        "});\n"
        "})();\n"
    )
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": new_content})
    assert r.status_code == 200
    data = r.json()
    assert data["warnings"] == []
    assert data["changed"] is True
    assert data["rev"] != old_rev
    assert (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8") == new_content
    assert broadcast_captured and broadcast_captured[-1]["type"] == "manifest"


def test_put_file_empty_content(client, editor_env):
    # viewer.js 不可存空（B6）
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": "   "})
    assert r.status_code == 400
    assert "non-empty" in r.json()["detail"]
    ed.editor_limiter.reset()
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": ""})
    assert r.status_code == 400
    # console.js 可存空（B6）：寫入空檔
    ed.editor_limiter.reset()
    r = client.put("/api/editor/effect/particle/console.js", json={"content": ""})
    assert r.status_code == 200
    assert (editor_env["env_dir"] / "particle" / "console.js").read_text(encoding="utf-8") == ""


def test_put_file_warning_without_register(client, editor_env):
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": "// no register call\n"})
    assert r.status_code == 200
    assert r.json()["warnings"] == ["viewer.js 無 window.Effects.register("]
    ed.editor_limiter.reset()
    r = client.put("/api/editor/effect/particle/console.js", json={"content": "// no register call\n"})
    assert r.status_code == 200
    assert r.json()["warnings"] == ["console.js 無 window.RTX_EFFECT_CONSOLE.register("]


def test_put_file_unknown_effect(client, editor_env):
    r = client.put("/api/editor/effect/ghost/viewer.js", json={"content": "x"})
    assert r.status_code == 400
    assert "unknown effect" in r.json()["detail"]


def test_put_file_invalid_id(client, editor_env):
    assert client.put("/api/editor/effect/bad%20id/viewer.js", json={"content": "x"}).status_code == 404


def test_put_file_requires_key(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.put("/api/editor/effect/particle/viewer.js", json={"content": "x"}).status_code == 401
    ed.editor_limiter.reset()
    r = client.put(
        "/api/editor/effect/particle/viewer.js",
        json={"content": "x"},
        headers={"X-Access-Key": "secret"},
    )
    assert r.status_code == 200


def test_put_file_rate_limited(client, editor_env):
    assert client.put("/api/editor/effect/particle/viewer.js", json={"content": "x"}).status_code == 200
    assert client.put("/api/editor/effect/ripple/viewer.js", json={"content": "y"}).status_code == 429


def test_put_file_too_large_413(client, editor_env):
    # S2：單檔內容上限（FILE_CONTENT_MAX_BYTES），超限回 413
    big = "x" * (ed.FILE_CONTENT_MAX_BYTES + 1)
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": big})
    assert r.status_code == 413
    assert "too large" in r.json()["detail"]
    ed.editor_limiter.reset()
    r = client.put(
        "/api/editor/effect/particle/file",
        json={"filename": "custom.js", "content": "x" * (ed.FILE_CONTENT_MAX_BYTES + 1)},
    )
    assert r.status_code == 413
    assert "too large" in r.json()["detail"]


def test_delete_console_file(client, editor_env, broadcast_captured):
    old_rev = fx.MANIFEST_REV
    r = client.delete("/api/editor/effect/text/console.js")
    assert r.status_code == 200
    data = r.json()
    assert data["changed"] is True
    assert data["rev"] != old_rev
    assert not (editor_env["env_dir"] / "text" / "console.js").exists()
    assert fx.EFFECTS["text"]["consoleUrl"] is None
    assert broadcast_captured and broadcast_captured[-1]["type"] == "manifest"


def test_delete_console_file_missing(client, editor_env):
    assert client.delete("/api/editor/effect/firework/console.js").status_code == 404


def test_delete_console_file_unknown_effect(client, editor_env):
    r = client.delete("/api/editor/effect/ghost/console.js")
    assert r.status_code == 400


def test_delete_console_file_requires_key(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    assert client.delete("/api/editor/effect/text/console.js").status_code == 401
    ed.editor_limiter.reset()
    assert client.delete(
        "/api/editor/effect/text/console.js", headers={"X-Access-Key": "secret"}
    ).status_code == 200


# ---------------------------------------------------------------------------
# .backup 備份（修改前 manifest＋受影響插件檔）
# ---------------------------------------------------------------------------


def _backup_dirs(env: dict) -> list[Path]:
    backup_dir = env["env_dir"] / ".backup"
    if not backup_dir.is_dir():
        return []
    return [p for p in backup_dir.iterdir() if p.is_dir()]


def test_backup_put_viewer_file_includes_previous_content(client, editor_env):
    viewer_path = editor_env["env_dir"] / "particle" / "viewer.js"
    old_content = viewer_path.read_text(encoding="utf-8")
    r = client.put("/api/editor/effect/particle/viewer.js", json={"content": "// updated viewer\n"})
    assert r.status_code == 200
    backups = _backup_dirs(editor_env)
    assert len(backups) == 1
    assert json.loads(
        (backups[0] / "effects.json").read_text(encoding="utf-8")
    ) == _written_manifest(editor_env)
    assert (backups[0] / "particle" / "viewer.js").read_text(encoding="utf-8") == old_content
    assert viewer_path.read_text(encoding="utf-8") == "// updated viewer\n"


def test_backup_put_console_file_includes_previous_content(client, editor_env):
    console_path = editor_env["env_dir"] / "text" / "console.js"
    old_content = console_path.read_text(encoding="utf-8")
    r = client.put("/api/editor/effect/text/console.js", json={"content": "// updated console\n"})
    assert r.status_code == 200
    backups = _backup_dirs(editor_env)
    assert len(backups) == 1
    assert (backups[0] / "text" / "console.js").read_text(encoding="utf-8") == old_content
    assert console_path.read_text(encoding="utf-8") == "// updated console\n"


def test_backup_delete_console_file_includes_previous_content(client, editor_env):
    console_path = editor_env["env_dir"] / "text" / "console.js"
    old_content = console_path.read_text(encoding="utf-8")
    r = client.delete("/api/editor/effect/text/console.js")
    assert r.status_code == 200
    backups = _backup_dirs(editor_env)
    assert len(backups) == 1
    assert (backups[0] / "text" / "console.js").read_text(encoding="utf-8") == old_content
    assert not console_path.exists()


def test_backup_delete_effect_dir_includes_previous_files(client, editor_env):
    before = _written_manifest(editor_env)
    r = client.delete("/api/editor/effect/text?deleteFiles=true")
    assert r.status_code == 200
    backups = _backup_dirs(editor_env)
    assert len(backups) == 1
    backup = backups[0]
    assert json.loads((backup / "effects.json").read_text(encoding="utf-8")) == before
    assert "text" in before["effects"]
    assert (backup / "text" / "viewer.js").is_file()
    assert (backup / "text" / "console.js").is_file()
    assert not (editor_env["env_dir"] / "text").exists()


def test_backup_put_file_unchanged_not_created(client, editor_env):
    raw = (editor_env["env_dir"] / "particle" / "viewer.js").read_bytes()
    r = client.put(
        "/api/editor/effect/particle/viewer.js", json={"content": raw.decode("utf-8")}
    )
    assert r.status_code == 200
    assert r.json()["changed"] is False
    assert _backup_dirs(editor_env) == []


def test_backup_retention_mixed_writes(client, editor_env):
    for i in range(6):
        ed.editor_limiter.reset()
        if i % 2 == 0:
            body = {"manifest": _current_manifest()}
            body["manifest"]["effects"]["ripple"]["label"] = f"Mix {i}"
            r = client.put("/api/editor/manifest", json=body)
        else:
            r = client.put(
                "/api/editor/effect/ripple/viewer.js", json={"content": f"// mix {i}\n"}
            )
        assert r.status_code == 200
    assert len(_backup_dirs(editor_env)) == 5


def test_backup_retention_deleted_effect_survives_unrelated_edits(client, editor_env):
    # S1: deleting an effect (with files) then making unrelated edits must not
    # evict the deleted effect's backup (per-effect retention, not a global window).
    ed.editor_limiter.reset()
    r = client.delete("/api/editor/effect/text?deleteFiles=true")
    assert r.status_code == 200
    delete_backup = next((p for p in _backup_dirs(editor_env) if (p / "text").is_dir()), None)
    assert delete_backup is not None
    assert (delete_backup / "text" / "viewer.js").is_file()
    stamp = delete_backup.name

    for i in range(6):
        ed.editor_limiter.reset()
        if i % 2 == 0:
            body = {"manifest": _current_manifest()}
            body["manifest"]["effects"]["particle"]["label"] = f"survive {i}"
            r = client.put("/api/editor/manifest", json=body)
        else:
            r = client.put(
                "/api/editor/effect/ripple/viewer.js", json={"content": f"// survive {i}\n"}
            )
        assert r.status_code == 200

    retained = [p for p in _backup_dirs(editor_env) if p.name == stamp]
    assert retained, "deleted effect's backup was evicted by unrelated edits"
    assert (retained[0] / "text" / "viewer.js").is_file()


# ---------------------------------------------------------------------------
# POST /api/editor/export
# ---------------------------------------------------------------------------


def test_export_all(client, editor_env):
    r = client.post(
        "/api/editor/export",
        json={"manifest": _written_manifest(editor_env), "files": [], "ids": None},
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/zip")
    assert r.headers["content-disposition"] == 'attachment; filename="effects.zip"'
    names = _zip_names(r.content)
    assert "effects.json" in names
    assert "particle/viewer.js" in names
    assert "particle/console.js" in names
    assert "ripple/viewer.js" in names
    assert "ripple/console.js" in names
    assert "firework/viewer.js" in names
    assert "text/viewer.js" in names
    assert "text/console.js" in names
    with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
        manifest_in_zip = json.loads(archive.read("effects.json"))
    assert manifest_in_zip == json.loads(editor_env["manifest_path"].read_text(encoding="utf-8"))


def test_export_uses_staged_files(client, editor_env):
    manifest = _written_manifest(editor_env)
    r = client.post(
        "/api/editor/export",
        json={
            "manifest": manifest,
            "files": [
                {
                    "effectId": "particle",
                    "filename": "viewer.js",
                    "content": "// staged viewer（未落盤）\n",
                }
            ],
            "ids": None,
        },
    )
    assert r.status_code == 200
    with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
        content = archive.read("particle/viewer.js").decode("utf-8")
        names = set(archive.namelist())
    assert content == "// staged viewer（未落盤）\n"
    # 未提供的檔仍從磁碟讀取
    assert "particle/console.js" in names


def test_export_selected_ids(client, editor_env):
    manifest = _current_manifest()
    r = client.post(
        "/api/editor/export",
        json={"manifest": manifest, "files": [], "ids": "particle,text"},
    )
    assert r.status_code == 200
    names = _zip_names(r.content)
    assert "particle/viewer.js" in names
    assert "text/viewer.js" in names
    assert not any(n.startswith("ripple/") for n in names)
    assert not any(n.startswith("firework/") for n in names)
    with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
        subset = json.loads(archive.read("effects.json"))
    assert subset["version"] == 2
    assert set(subset["effects"]) == {"particle", "text"}
    assert subset["effects"]["particle"] == manifest["effects"]["particle"]
    assert subset["effects"]["text"] == manifest["effects"]["text"]
    assert subset["currentEffects"] == ["particle"]
    assert subset["alternateEffects"] == ["text"]


def test_export_subset_roundtrip(client, editor_env):
    r = client.post(
        "/api/editor/export",
        json={"manifest": _current_manifest(), "files": [], "ids": "particle,text"},
    )
    assert r.status_code == 200
    original = _written_manifest(editor_env)
    text_entry = original["effects"]["text"]
    shrunken = deepcopy(original)
    del shrunken["effects"]["text"]
    shrunken["currentEffects"] = [i for i in shrunken["currentEffects"] if i != "text"]
    shrunken["alternateEffects"] = [i for i in shrunken["alternateEffects"] if i != "text"]
    editor_env["manifest_path"].write_text(
        json.dumps(shrunken, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    fx.reload_effects()
    ed.editor_limiter.reset()
    r2 = _import(client, r.content)
    assert r2.status_code == 200
    body = r2.json()
    assert body["created"] == ["text"]
    assert "text" in body["effects"]
    written = _written_manifest(editor_env)
    assert written["effects"]["text"] == text_entry
    assert written["effects"]["particle"] == original["effects"]["particle"]
    assert set(written["effects"]) == set(original["effects"])
    assert written["currentEffects"] == ["particle", "ripple"]
    assert written["alternateEffects"] == ["firework", "text"]


def test_export_unknown_id_skipped(client, editor_env):
    r = client.post(
        "/api/editor/export",
        json={"manifest": _current_manifest(), "files": [], "ids": "particle,ghost"},
    )
    assert r.status_code == 200
    names = _zip_names(r.content)
    assert not any(n.startswith("ghost/") for n in names)


def test_export_invalid_id_400(client, editor_env):
    r = client.post(
        "/api/editor/export",
        json={"manifest": _current_manifest(), "files": [], "ids": "bad id"},
    )
    assert r.status_code == 400
    assert "invalid effect id" in r.json()["detail"]


# ---------------------------------------------------------------------------
# POST /api/editor/import
# ---------------------------------------------------------------------------


def test_import_new_effect(client, editor_env, broadcast_captured):
    manifest = _current_manifest()
    manifest["effects"]["zap"] = {
        "label": "Zap",
        "viewer": "viewer.js",
        "console": "console.js",
        "params": {},
    }
    manifest["currentEffects"].append("zap")
    data = _build_zip(
        manifest,
        {
            "zap/viewer.js": 'window.Effects.register("zap", function (px, py, params) { return { update: function () {}, done: function () { return true; }, draw: function () {} }; });',
            "zap/console.js": 'window.RTX_EFFECT_CONSOLE.register("zap", { iconID: "zap", render: function () {} });',
        },
    )
    r = _import(client, data)
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == ["zap"]
    assert "zap" in body["effects"]
    viewer = (editor_env["env_dir"] / "zap" / "viewer.js").read_text(encoding="utf-8")
    assert 'register("zap"' in viewer
    assert "zap" in _written_manifest(editor_env)["effects"]
    assert broadcast_captured and broadcast_captured[-1]["type"] == "manifest"


def test_import_new_effect_missing_viewer_uses_template(client, editor_env):
    manifest = _current_manifest()
    manifest["effects"]["zap"] = {"label": "Zap", "viewer": "viewer.js", "params": {}}
    manifest["currentEffects"].append("zap")
    r = _import(client, _build_zip(manifest))
    assert r.status_code == 200
    viewer = (editor_env["env_dir"] / "zap" / "viewer.js").read_text(encoding="utf-8")
    assert "window.Effects.register(" in viewer
    assert 'register("zap"' in viewer


def test_import_updates_existing_effect(client, editor_env):
    manifest = _current_manifest()
    manifest["effects"]["particle"]["label"] = "Imported Particle"
    data = _build_zip(manifest, {"particle/viewer.js": "// imported viewer\n"})
    r = _import(client, data)
    assert r.status_code == 200
    assert r.json()["created"] == []
    assert _written_manifest(editor_env)["effects"]["particle"]["label"] == "Imported Particle"
    assert (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8") == "// imported viewer\n"


def test_import_adopts_layout_when_present(client, editor_env):
    manifest = _current_manifest()
    manifest["currentEffects"] = ["particle"]
    manifest["alternateEffects"] = ["ripple"]
    r = _import(client, _build_zip(manifest))
    assert r.status_code == 200
    assert fx.MANIFEST_CURRENT_EFFECTS == ["particle"]
    assert set(fx.MANIFEST_ALTERNATE_EFFECTS) == {"ripple", "firework", "text"}


def test_import_keeps_layout_when_absent(client, editor_env):
    manifest = _current_manifest()
    del manifest["currentEffects"]
    del manifest["alternateEffects"]
    r = _import(client, _build_zip(manifest))
    assert r.status_code == 200
    assert fx.MANIFEST_CURRENT_EFFECTS == ["particle", "ripple"]


def test_import_invalid_manifest_version(client, editor_env):
    manifest = _current_manifest()
    manifest["version"] = 1
    r = _import(client, _build_zip(manifest))
    assert r.status_code == 400
    assert "version must be 2" in r.json()["detail"]


def test_import_invalid_manifest_rolls_back_written_files(client, editor_env):
    manifest = _current_manifest()
    manifest["effects"]["bad"] = {"label": "Bad", "viewer": "missing.js", "params": {}}
    manifest["currentEffects"].append("bad")
    data = _build_zip(manifest, {"particle/viewer.js": "// evil overwrite\n"})
    before_viewer = (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8")
    before_manifest = editor_env["manifest_path"].read_text(encoding="utf-8")
    r = _import(client, data)
    assert r.status_code == 400
    assert (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8") == before_viewer
    assert editor_env["manifest_path"].read_text(encoding="utf-8") == before_manifest
    assert "bad" not in fx.EFFECTS


def test_import_missing_effects_json(client, editor_env):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("particle/viewer.js", "x")
    assert _import(client, buffer.getvalue()).status_code == 400


def test_import_not_a_zip(client, editor_env):
    assert _import(client, b"not a zip").status_code == 400


def test_import_zip_slip_rejected(client, editor_env):
    manifest = _current_manifest()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("effects.json", json.dumps(manifest))
        archive.writestr("../evil.js", "bad")
    r = _import(client, buffer.getvalue())
    assert r.status_code == 400
    assert not (editor_env["env_dir"].parent / "evil.js").exists()


def test_import_too_large(client, editor_env):
    r = client.post(
        "/api/editor/import",
        files={"file": ("big.zip", io.BytesIO(os.urandom(ed.IMPORT_MAX_BYTES + 1)), "application/zip")},
    )
    assert r.status_code == 413


def test_import_on_v1_is_read_only(client, editor_env, monkeypatch):
    v1_path = editor_env["env_dir"] / "v1.json"
    v1_path.write_text(json.dumps(json.loads(FIXTURE_V1.read_text(encoding="utf-8"))), encoding="utf-8")
    monkeypatch.setattr(fx, "MANIFEST_PATH", v1_path)
    fx.reload_effects()
    assert _import(client, _build_zip(_current_manifest())).status_code == 400


def test_import_requires_key(client, editor_env, monkeypatch):
    monkeypatch.setattr(ed, "ACCESS_KEY", "secret")
    data = _build_zip(_current_manifest())
    assert _import(client, data).status_code == 401
    ed.editor_limiter.reset()
    assert _import(client, data, key="secret").status_code == 200


def test_import_rate_limited(client, editor_env):
    data = _build_zip(_current_manifest())
    assert _import(client, data).status_code == 200
    assert _import(client, data).status_code == 429


def test_import_dryrun_returns_staged_no_write(client, editor_env):
    manifest = _current_manifest()
    manifest["effects"]["zap"] = {
        "label": "Zap",
        "viewer": "viewer.js",
        "console": "console.js",
        "params": {},
    }
    manifest["currentEffects"].append("zap")
    data = _build_zip(
        manifest,
        {
            "zap/viewer.js": 'window.Effects.register("zap", function (px, py, p) { return {}; });',
            "zap/console.js": 'window.RTX_EFFECT_CONSOLE.register("zap", { iconID: "zap", render: function () {} });',
        },
    )
    before_manifest = editor_env["manifest_path"].read_text(encoding="utf-8")
    r = client.post(
        "/api/editor/import?dryRun=true",
        files={"file": ("effects.zip", io.BytesIO(data), "application/zip")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["dryRun"] is True
    assert "zap" in body["importedEffects"]
    assert body["importedLayout"]["currentEffects"][-1] == "zap"
    assert body["files"]["zap/viewer.js"].startswith('window.Effects.register("zap"')
    assert "particle/viewer.js" not in body["files"]
    assert body["baseRev"] == fx.MANIFEST_REV
    # no write: manifest unchanged, no zap dir, no new effect
    assert editor_env["manifest_path"].read_text(encoding="utf-8") == before_manifest
    assert not (editor_env["env_dir"] / "zap").exists()
    assert "zap" not in fx.EFFECTS


def test_import_dryrun_invalid_manifest_400(client, editor_env):
    manifest = _current_manifest()
    manifest["version"] = 1
    r = client.post(
        "/api/editor/import?dryRun=true",
        files={"file": ("effects.zip", io.BytesIO(_build_zip(manifest)), "application/zip")},
    )
    assert r.status_code == 400
    assert "version must be 2" in r.json()["detail"]


def test_put_file_endpoint_writes_file(client, editor_env):
    r = client.put(
        "/api/editor/effect/particle/file",
        json={"filename": "custom.js", "content": "// custom\n"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert (editor_env["env_dir"] / "particle" / "custom.js").read_text(encoding="utf-8") == "// custom\n"


def test_put_manifest_with_files_writes_atomically(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["files"] = [
        {"effectId": "particle", "filename": "viewer.js", "content": "// atomic v2\n"},
    ]
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert (editor_env["env_dir"] / "particle" / "viewer.js").read_text(encoding="utf-8") == "// atomic v2\n"
    # viewer.js 無 window.Effects.register( → 非阻斷 warning
    assert any("register" in w for w in r.json()["warnings"])


def test_put_manifest_files_unknown_effect_404(client, editor_env):
    body = {"manifest": _current_manifest()}
    body["files"] = [{"effectId": "nope", "filename": "viewer.js", "content": "x\n"}]
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 404
    assert "unknown effect" in r.json()["detail"]


def test_put_manifest_staged_file_too_large_413(client, editor_env):
    # S2：manifest 內 staged 檔案內容亦受 FILE_CONTENT_MAX_BYTES 限制
    body = {"manifest": _current_manifest()}
    body["files"] = [
        {"effectId": "particle", "filename": "viewer.js", "content": "x" * (ed.FILE_CONTENT_MAX_BYTES + 1)},
    ]
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 413
    assert "too large" in r.json()["detail"]


def test_put_file_invalid_filename_400(client, editor_env):
    r = client.put(
        "/api/editor/effect/particle/file",
        json={"filename": "../evil.js", "content": "bad"},
    )
    assert r.status_code == 400
    assert "invalid filename" in r.json()["detail"]
    r2 = client.put(
        "/api/editor/effect/particle/file",
        json={"filename": "a/b.js", "content": "bad"},
    )
    assert r2.status_code == 400


# ---------------------------------------------------------------------------
# Static /editor routes
# ---------------------------------------------------------------------------


def test_editor_static_404(client, tmp_path, monkeypatch):
    monkeypatch.setattr(ed, "EDITOR_DIR", tmp_path / "nope")
    assert client.get("/editor").status_code == 404
    assert client.get("/editor/").status_code == 404
    assert client.get("/editor/app.js").status_code == 404
    assert client.get("/editor/style.css").status_code == 404


def test_editor_static_serves_when_present(client, tmp_path, monkeypatch):
    ed_dir = tmp_path / "editor"
    ed_dir.mkdir()
    (ed_dir / "index.html").write_text("<html></html>", encoding="utf-8")
    (ed_dir / "app.js").write_text("console.log(1);", encoding="utf-8")
    (ed_dir / "style.css").write_text("body{}", encoding="utf-8")
    monkeypatch.setattr(ed, "EDITOR_DIR", ed_dir)
    r = client.get("/editor")
    assert r.status_code == 200
    assert r.text == "<html></html>"
    assert client.get("/editor/app.js").status_code == 200
    assert client.get("/editor/style.css").status_code == 200


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------


def test_editor_manifest_saved_log(client, editor_env, caplog):
    caplog.set_level(logging.INFO, logger="server")
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["particle"]["label"] = "Log Label"
    client.put("/api/editor/manifest", json=body)
    assert any(
        re.search(r"editor_manifest_saved rev=\w+ changed=true created=0 removed=0 files=0 client=\S+", rec.message)
        for rec in caplog.records
    )


def test_editor_effect_created_log(client, editor_env, caplog):
    caplog.set_level(logging.INFO, logger="server")
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["spark"] = {"label": "火花", "params": {}}
    body["manifest"]["currentEffects"].append("spark")
    client.put("/api/editor/manifest", json=body)
    assert any("editor_effect_created effect=spark" in rec.message for rec in caplog.records)


def test_editor_effect_removed_log(client, editor_env, caplog):
    caplog.set_level(logging.INFO, logger="server")
    client.delete("/api/editor/effect/text?deleteFiles=true")
    assert any(
        re.search(r"editor_effect_removed effect=text files=true rev=\w+ client=\S+", rec.message)
        for rec in caplog.records
    )


def test_editor_file_saved_log(client, editor_env, caplog):
    caplog.set_level(logging.INFO, logger="server")
    client.put("/api/editor/effect/particle/viewer.js", json={"content": "// ok\n"})
    assert any(
        re.search(r"editor_file_saved effect=particle file=viewer\.js changed=true client=\S+", rec.message)
        for rec in caplog.records
    )


def test_editor_manifest_rejected_log(client, editor_env, caplog):
    caplog.set_level(logging.ERROR, logger="server")
    body = {"manifest": _current_manifest()}
    body["manifest"]["effects"]["broken"] = {"label": "Broken", "viewer": "missing.js", "params": {}}
    body["manifest"]["currentEffects"].append("broken")
    r = client.put("/api/editor/manifest", json=body)
    assert r.status_code == 400
    recs = [rec for rec in caplog.records if "editor_manifest_rejected" in rec.message]
    assert recs
    assert "missing viewer file" in recs[0].message


def test_editor_file_content_not_logged(client, editor_env, caplog):
    caplog.set_level(logging.DEBUG, logger="server")
    secret = "SECRET-CONTENT-xyz"
    client.put("/api/editor/effect/particle/viewer.js", json={"content": secret})
    assert all(secret not in rec.message for rec in caplog.records)
