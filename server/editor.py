import asyncio
import io
import json
import logging
import os
import shutil
import time
import uuid
import zipfile
from copy import deepcopy
from pathlib import Path

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

import server.effects as _effects
from server.config import ACCESS_KEY
from server.effects import EFFECT_ID_RE, ManifestError, _validate_manifest, reload_effects
from server.logging import client_host
from server.relay import RateLimiter, broadcast
from server.security import check_key
from server.static_files import NO_STORE, file_response

logger = logging.getLogger(__name__)

EDITOR_DIR = Path(__file__).resolve().parent.parent / "editor"
BACKUP_DIRNAME = ".backup"
BACKUP_KEEP = 5
IMPORT_MAX_BYTES = 10 * 1024 * 1024
FILE_CONTENT_MAX_BYTES = 1024 * 1024

editor_limiter = RateLimiter()
router = APIRouter()

VIEWER_TEMPLATE = """(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  window.Effects.register("__ID__", function (px, py, params) {
    var duration = Math.max(100, Number(params && params.duration) || 1000);
    var elapsed = 0;
    return {
      update: function (dt) {
        elapsed += dt;
      },
      done: function () {
        return elapsed >= duration;
      },
      draw: function (ctx) {
        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.restore();
      },
    };
  });
})();
"""

CONSOLE_TEMPLATE = """(function () {
  "use strict";

  if (typeof window === "undefined" || !window.RTX_EFFECT_CONSOLE) return;

  window.RTX_EFFECT_CONSOLE.register("__ID__", {
    iconID: "__ID__",
    render: function (container, api) {
      if (!container || !api) return;
      var fields = api.fields || [];
      fields.forEach(function (d) {
        var field = document.createElement("div");
        field.className = "rtx-field";
        var label = document.createElement("label");
        label.textContent = d.label;
        var input = document.createElement("input");
        input.id = "rtx-p-" + d.key;
        input.type =
          d.type === "color"
            ? "color"
            : d.type === "integer" || d.type === "number"
              ? "number"
              : "text";
        var value = api.getValue(d.key);
        if (value == null) {
          value = api.defaults && api.defaults[d.key] != null ? api.defaults[d.key] : "";
        }
        input.value = value;
        if (d.min != null) input.min = d.min;
        if (d.max != null) input.max = d.max;
        if (d.step != null) input.step = d.step;
        if (d.maxLength != null) input.maxLength = d.maxLength;
        field.appendChild(label);
        field.appendChild(input);
        container.appendChild(field);
      });
    },
  });
})();
"""


class EffectFileEntry(BaseModel):
    effectId: str
    filename: str
    content: str


class ManifestBody(BaseModel):
    manifest: dict
    baseRev: str | None = None
    deleteRemoved: bool | list[str] = False
    files: list[EffectFileEntry] = Field(default_factory=list)


class ExportBody(BaseModel):
    manifest: dict
    files: list[EffectFileEntry] = Field(default_factory=list)
    ids: str | None = None


class FileBody(BaseModel):
    content: str


class EffectFileBody(BaseModel):
    filename: str
    content: str


def _effect_dir(effect_id: str) -> Path:
    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    base = _effects.EFFECTS_DIR.resolve()
    target = (base / effect_id).resolve()
    if not target.is_relative_to(base):
        raise HTTPException(status_code=404, detail="not found")
    return target


def _file_path(effect_id: str, filename: str) -> Path:
    base = _effects.EFFECTS_DIR.resolve()
    target = (base / effect_id / filename).resolve()
    if not target.is_relative_to(base):
        raise HTTPException(status_code=404, detail="not found")
    return target


def _require_known_effect(effect_id: str) -> None:
    manifest = _effects.MANIFEST
    if effect_id not in (manifest.get("effects") or {}):
        raise HTTPException(status_code=400, detail=f"unknown effect: {effect_id}")


def _require_editable_manifest() -> None:
    if _effects.MANIFEST_VERSION != 2:
        raise HTTPException(status_code=400, detail="v1 manifest is read-only")


def _write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _prune_backups(backup_dir: Path) -> None:
    entries = sorted(
        (p for p in backup_dir.iterdir() if p.is_dir()),
        key=lambda p: p.stat().st_mtime,
    )
    for stray in backup_dir.iterdir():
        if stray.is_dir():
            continue
        try:
            stray.unlink()
        except OSError:
            pass
    if len(entries) <= BACKUP_KEEP:
        return

    def covered_effect_ids(p: Path) -> set[str]:
        try:
            return {sub.name for sub in p.iterdir() if sub.is_dir()}
        except OSError:
            return set()

    backups = [(p, covered_effect_ids(p)) for p in entries]
    needed: set[Path] = set()
    # Most recent snapshots overall (manifest-only edits included).
    for p, _ in backups[-BACKUP_KEEP:]:
        needed.add(p)
    # Per effect: keep its most recent snapshots so an unrelated edit to another
    # effect cannot evict a deleted effect's backup (S1: silent data loss).
    for effect_id in {eff for _, effs in backups for eff in effs}:
        covering = [p for p, effs in backups if effect_id in effs]
        for p in covering[-BACKUP_KEEP:]:
            needed.add(p)
    for p, _ in backups:
        if p in needed:
            continue
        try:
            shutil.rmtree(p, ignore_errors=True)
        except OSError:
            pass


def _backup_state(files: dict[Path, bytes] | None = None) -> None:
    src = _effects.MANIFEST_PATH
    if not src.is_file() and not files:
        return
    backup_dir = _effects.EFFECTS_DIR / BACKUP_DIRNAME
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d%H%M%S")
    target = backup_dir / stamp
    seq = 1
    while target.exists():
        target = backup_dir / f"{stamp}-{seq:02d}"
        seq += 1
    target.mkdir()
    if src.is_file():
        shutil.copy2(src, target / "effects.json")
    base = _effects.EFFECTS_DIR.resolve()
    for path, data in (files or {}).items():
        dest = target / path.relative_to(base)
        dest.parent.mkdir(parents=True, exist_ok=True)
        _write_atomic(dest, data)
    _prune_backups(backup_dir)


def _write_manifest(raw: dict, files: dict[Path, bytes] | None = None) -> bool:
    src = _effects.MANIFEST_PATH
    try:
        existing = json.loads(src.read_bytes())
    except (OSError, ValueError):
        existing = None
    if existing == raw:
        return False
    _backup_state(files)
    payload = (json.dumps(raw, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    _write_atomic(src, payload)
    return True


def _ensure_new_effect_files(effect_id: str, spec: dict) -> bool:
    directory = _effect_dir(effect_id)
    if directory.exists():
        return False
    directory.mkdir(parents=True, exist_ok=True)
    viewer = spec.get("viewer", "viewer.js")
    if viewer == "viewer.js":
        (directory / "viewer.js").write_text(
            VIEWER_TEMPLATE.replace("__ID__", effect_id), encoding="utf-8"
        )
    if "console" in spec and spec.get("console") == "console.js":
        (directory / "console.js").write_text(
            CONSOLE_TEMPLATE.replace("__ID__", effect_id), encoding="utf-8"
        )
    return True


def _rollback_dirs(dirs: list[Path]) -> None:
    for directory in reversed(dirs):
        try:
            if directory.exists():
                shutil.rmtree(directory, ignore_errors=True)
        except OSError:
            pass


def _rollback_writes(original: dict[Path, bytes | None], dirs_created: list[Path]) -> None:
    for target, data in original.items():
        try:
            if data is None:
                if target.is_file():
                    target.unlink()
            else:
                _write_atomic(target, data)
        except OSError:
            pass
    for directory in reversed(dirs_created):
        try:
            if directory.is_dir() and not any(directory.iterdir()):
                directory.rmdir()
        except OSError:
            pass


def _broadcast_manifest(rev: str, new_effects: dict) -> None:
    broadcast(
        {
            "id": str(uuid.uuid4()),
            "type": "manifest",
            "rev": rev,
            "version": _effects.MANIFEST_VERSION,
            "effects": new_effects,
            "currentEffects": _effects.MANIFEST_CURRENT_EFFECTS,
            "alternateEffects": _effects.MANIFEST_ALTERNATE_EFFECTS,
            "ts": int(time.time()),
        }
    )


def _manifest_from_zip(data: bytes) -> tuple[dict, dict[str, bytes]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="invalid zip file") from exc
    entries: dict[str, bytes] = {}
    with archive:
        for info in archive.infolist():
            name = info.filename
            if name.endswith("/"):
                continue
            normalized = name.replace("\\", "/")
            if "\x00" in name or normalized.startswith("/"):
                raise HTTPException(status_code=400, detail="invalid zip entry")
            parts = [part for part in normalized.split("/") if part not in ("", ".")]
            if not parts or any(part == ".." for part in parts):
                raise HTTPException(status_code=400, detail="invalid zip entry")
            entries[normalized] = archive.read(info)
    if "effects.json" not in entries:
        raise HTTPException(status_code=400, detail="zip missing effects.json")
    try:
        manifest = json.loads(entries["effects.json"].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="invalid effects.json in zip") from exc
    return manifest, entries


@router.get("/api/editor/manifest")
async def get_manifest() -> dict:
    return {"rev": _effects.MANIFEST_REV, "manifest": _effects.MANIFEST}


@router.put("/api/editor/manifest")
async def put_manifest(
    body: ManifestBody,
    request: Request,
    x_access_key: str | None = Header(default=None),
) -> dict:
    path = str(request.url.path)
    client = client_host(request)
    check_key(ACCESS_KEY, x_access_key, None, path=path, client=client)
    await editor_limiter.check(1, path=path, client=client)

    _require_editable_manifest()
    manifest = body.manifest
    if not isinstance(manifest, dict) or manifest.get("version") != 2:
        logger.error('editor_manifest_rejected error="manifest version must be 2" client=%s', client)
        raise HTTPException(status_code=400, detail="manifest version must be 2")
    if body.baseRev is not None and body.baseRev != _effects.MANIFEST_REV:
        raise HTTPException(status_code=409, detail="baseRev mismatch")

    effects_map = manifest.get("effects")
    if not isinstance(effects_map, dict) or not effects_map:
        logger.error('editor_manifest_rejected error="manifest must have a non-empty effects object" client=%s', client)
        raise HTTPException(status_code=400, detail="manifest must have a non-empty effects object")
    old_ids = set((_effects.MANIFEST.get("effects") or {}).keys())
    new_ids = set(effects_map.keys())
    created_ids = sorted(new_ids - old_ids)
    removed_ids = sorted(old_ids - new_ids)
    for effect_id in created_ids:
        if not EFFECT_ID_RE.fullmatch(effect_id):
            logger.error('editor_manifest_rejected error="invalid effect id" client=%s', client)
            raise HTTPException(status_code=400, detail=f"invalid effect id: {effect_id}")

    created_dirs: list[Path] = []
    for effect_id in created_ids:
        if _ensure_new_effect_files(effect_id, manifest["effects"][effect_id]):
            created_dirs.append(_effect_dir(effect_id))

    try:
        _validate_manifest(manifest)
    except ManifestError as exc:
        _rollback_dirs(created_dirs)
        logger.error('editor_manifest_rejected error="%s" client=%s', exc, client)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    affected: dict[Path, bytes] = {}
    if body.deleteRemoved:
        delete_ids = set(removed_ids)
        if isinstance(body.deleteRemoved, list):
            delete_ids = set()
            for item in body.deleteRemoved:
                if isinstance(item, str) and item in removed_ids:
                    delete_ids.add(item)
        for effect_id in delete_ids:
            directory = _effect_dir(effect_id)
            if directory.is_dir():
                for path in sorted(directory.rglob("*")):
                    if path.is_file():
                        affected[path] = path.read_bytes()
                shutil.rmtree(directory, ignore_errors=True)

    _write_manifest(manifest, affected)
    # 同批次寫入 staged 檔案（與 manifest 同一原子請求，不再逐檔 PUT、不受限頻阻塞）
    file_warnings: list[str] = []
    known = set(manifest.get("effects", {}).keys())
    for entry in body.files:
        if entry.effectId not in known:
            logger.error('editor_manifest_rejected error="unknown effect in staged files" client=%s', client)
            raise HTTPException(status_code=404, detail=f"unknown effect: {entry.effectId}")
        file_warnings.extend(_write_staged_file(entry.effectId, entry.filename, entry.content))
    new_effects, rev, changed = await asyncio.to_thread(reload_effects)
    if changed:
        _broadcast_manifest(rev, new_effects)
    for effect_id in created_ids:
        logger.info("editor_effect_created effect=%s client=%s", effect_id, client)
    logger.info(
        "editor_manifest_saved rev=%s changed=%s created=%d removed=%d files=%d client=%s",
        rev,
        str(changed).lower(),
        len(created_ids),
        len(removed_ids),
        len(body.files),
        client,
    )
    return {
        "ok": True,
        "changed": changed,
        "rev": rev,
        "created": created_ids,
        "effects": list(new_effects.keys()),
        "warnings": file_warnings,
    }


@router.delete("/api/editor/effect/{effect_id}")
async def delete_effect(
    effect_id: str,
    request: Request,
    deleteFiles: bool = Query(default=False),
    x_access_key: str | None = Header(default=None),
) -> dict:
    path = str(request.url.path)
    client = client_host(request)
    check_key(ACCESS_KEY, x_access_key, None, path=path, client=client)
    await editor_limiter.check(1, path=path, client=client)

    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    _require_editable_manifest()
    _require_known_effect(effect_id)

    new_raw = deepcopy(_effects.MANIFEST)
    new_effects_map = dict(new_raw.get("effects") or {})
    del new_effects_map[effect_id]
    new_raw["effects"] = new_effects_map
    for key in ("currentEffects", "alternateEffects"):
        if isinstance(new_raw.get(key), list):
            new_raw[key] = [item for item in new_raw[key] if item != effect_id]

    try:
        _validate_manifest(new_raw)
    except ManifestError as exc:
        logger.error('editor_manifest_rejected error="%s" client=%s', exc, client)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    affected: dict[Path, bytes] = {}
    deleted_files = False
    if deleteFiles:
        directory = _effect_dir(effect_id)
        if directory.is_dir():
            for path in sorted(directory.rglob("*")):
                if path.is_file():
                    affected[path] = path.read_bytes()
            shutil.rmtree(directory, ignore_errors=True)
            deleted_files = True

    _write_manifest(new_raw, affected)
    new_effects, rev, changed = await asyncio.to_thread(reload_effects)
    if changed:
        _broadcast_manifest(rev, new_effects)
    logger.info(
        "editor_effect_removed effect=%s files=%s rev=%s client=%s",
        effect_id,
        str(deleted_files).lower(),
        rev,
        client,
    )
    return {
        "ok": True,
        "changed": changed,
        "rev": rev,
        "created": [],
        "effects": list(new_effects.keys()),
    }


@router.get("/api/editor/effect/{effect_id}/viewer.js")
async def get_viewer_file(
    effect_id: str, request: Request, template: bool = Query(default=False)
):
    if template:
        return _template_response(effect_id, "viewer.js")
    return _get_file(effect_id, "viewer.js", request)


@router.get("/api/editor/effect/{effect_id}/console.js")
async def get_console_file(
    effect_id: str, request: Request, template: bool = Query(default=False)
):
    if template:
        return _template_response(effect_id, "console.js")
    return _get_file(effect_id, "console.js", request)


def _template_response(effect_id: str, filename: str) -> Response:
    """回傳指定特效的 viewer.js／console.js 模板（`__ID__` 置換為 effect_id）。

    供編輯器在「新增特效尚無檔案」時直接套用模板（不落盤、不改 server 檔案）。
    """
    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    tpl = VIEWER_TEMPLATE if filename == "viewer.js" else CONSOLE_TEMPLATE
    return Response(
        content=tpl.replace("__ID__", effect_id),
        media_type="text/plain",
        headers=NO_STORE,
    )


def _get_file(effect_id: str, filename: str, request: Request):
    client = client_host(request)
    if not EFFECT_ID_RE.fullmatch(effect_id):
        logger.warning(
            "asset_missing path=/api/editor/effect/%s/%s client=%s", effect_id, filename, client
        )
        raise HTTPException(status_code=404, detail="not found")
    target = _file_path(effect_id, filename)
    if not target.is_file():
        logger.warning(
            "asset_missing path=/api/editor/effect/%s/%s client=%s", effect_id, filename, client
        )
        raise HTTPException(status_code=404, detail="not found")
    return Response(
        content=target.read_text(encoding="utf-8"),
        media_type="text/plain",
        headers=NO_STORE,
    )


@router.put("/api/editor/effect/{effect_id}/viewer.js")
async def put_viewer_file(
    effect_id: str,
    body: FileBody,
    request: Request,
    x_access_key: str | None = Header(default=None),
) -> dict:
    return await _put_file(effect_id, "viewer.js", body, request, x_access_key)


@router.put("/api/editor/effect/{effect_id}/console.js")
async def put_console_file(
    effect_id: str,
    body: FileBody,
    request: Request,
    x_access_key: str | None = Header(default=None),
) -> dict:
    return await _put_file(effect_id, "console.js", body, request, x_access_key)


@router.put("/api/editor/effect/{effect_id}/file")
async def put_effect_file(
    effect_id: str,
    body: EffectFileBody,
    request: Request,
    x_access_key: str | None = Header(default=None),
) -> dict:
    filename = body.filename
    if (
        not isinstance(filename, str)
        or not filename
        or "/" in filename
        or "\\" in filename
        or filename in (".", "..")
    ):
        raise HTTPException(status_code=400, detail="invalid filename")
    return await _put_file(effect_id, filename, body, request, x_access_key)


async def _put_file(
    effect_id: str,
    filename: str,
    body: FileBody,
    request: Request,
    x_access_key: str | None,
) -> dict:
    path = str(request.url.path)
    client = client_host(request)
    check_key(ACCESS_KEY, x_access_key, None, path=path, client=client)
    await editor_limiter.check(1, path=path, client=client)

    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    _require_known_effect(effect_id)
    content = body.content
    if not isinstance(content, str):
        raise HTTPException(status_code=400, detail="content must be a string")
    if len(content.encode("utf-8")) > FILE_CONTENT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="file content too large")
    if filename == "viewer.js" and not content.strip():
        raise HTTPException(status_code=400, detail="viewer.js content must be non-empty")

    target = _file_path(effect_id, filename)
    warnings: list[str] = []
    if filename == "viewer.js" and "window.Effects.register(" not in content:
        warnings.append("viewer.js 無 window.Effects.register(")
    elif filename == "console.js" and content.strip() and "window.RTX_EFFECT_CONSOLE.register(" not in content:
        warnings.append("console.js 無 window.RTX_EFFECT_CONSOLE.register(")

    new_bytes = content.encode("utf-8")
    if target.is_file():
        previous = target.read_bytes()
        if previous != new_bytes:
            _backup_state({target: previous})
    else:
        _backup_state()
    _write_atomic(target, new_bytes)
    new_effects, rev, changed = await asyncio.to_thread(reload_effects)
    if changed:
        _broadcast_manifest(rev, new_effects)
    logger.info(
        "editor_file_saved effect=%s file=%s changed=%s client=%s",
        effect_id,
        filename,
        str(changed).lower(),
        client,
    )
    return {"ok": True, "changed": changed, "rev": rev, "warnings": warnings}


def _write_staged_file(effect_id: str, filename: str, content: str) -> list[str]:
    if not isinstance(filename, str) or not filename or "/" in filename or "\\" in filename or filename in (".", ".."):
        raise HTTPException(status_code=400, detail="invalid filename")
    if not isinstance(content, str):
        raise HTTPException(status_code=400, detail="content must be a string")
    if len(content.encode("utf-8")) > FILE_CONTENT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="file content too large")
    if filename == "viewer.js" and not content.strip():
        raise HTTPException(status_code=400, detail="viewer.js content must be non-empty")
    warnings: list[str] = []
    if filename == "viewer.js" and "window.Effects.register(" not in content:
        warnings.append("viewer.js 無 window.Effects.register(")
    elif filename == "console.js" and content.strip() and "window.RTX_EFFECT_CONSOLE.register(" not in content:
        warnings.append("console.js 無 window.RTX_EFFECT_CONSOLE.register(")
    target = _file_path(effect_id, filename)
    new_bytes = content.encode("utf-8")
    if target.is_file():
        previous = target.read_bytes()
        if previous != new_bytes:
            _backup_state({target: previous})
    else:
        _backup_state()
    _write_atomic(target, new_bytes)
    return warnings


@router.delete("/api/editor/effect/{effect_id}/console.js")
async def delete_console_file(
    effect_id: str,
    request: Request,
    x_access_key: str | None = Header(default=None),
) -> dict:
    path = str(request.url.path)
    client = client_host(request)
    check_key(ACCESS_KEY, x_access_key, None, path=path, client=client)
    await editor_limiter.check(1, path=path, client=client)

    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    _require_known_effect(effect_id)

    target = _file_path(effect_id, "console.js")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="not found")
    _backup_state({target: target.read_bytes()})
    target.unlink()
    new_effects, rev, changed = await asyncio.to_thread(reload_effects)
    if changed:
        _broadcast_manifest(rev, new_effects)
    logger.info(
        "editor_file_saved effect=%s file=%s deleted=true changed=%s client=%s",
        effect_id,
        "console.js",
        str(changed).lower(),
        client,
    )
    return {"ok": True, "changed": changed, "rev": rev}


@router.post("/api/editor/export")
async def export_effects(request: Request, body: ExportBody):
    client = client_host(request)
    manifest = body.manifest or {}
    effects_map = manifest.get("effects") or {}
    selected = list(effects_map.keys())
    staged: dict[str, bytes] = {}
    for entry in body.files or []:
        if (
            isinstance(entry.effectId, str)
            and entry.effectId
            and isinstance(entry.filename, str)
            and entry.filename
        ):
            staged[f"{entry.effectId}/{entry.filename}"] = entry.content.encode("utf-8")
    if body.ids:
        wanted = [part for part in body.ids.split(",") if part]
        for part in wanted:
            if not EFFECT_ID_RE.fullmatch(part):
                raise HTTPException(status_code=400, detail=f"invalid effect id: {part}")
        wanted_set = set(wanted)
        selected = [effect_id for effect_id in selected if effect_id in wanted_set]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        if body.ids:
            selected_set = set(selected)
            cur = [i for i in (manifest.get("currentEffects") or []) if i in selected_set]
            alt = [i for i in (manifest.get("alternateEffects") or []) if i in selected_set]
            subset = {
                "version": 2,
                "currentEffects": cur,
                "alternateEffects": alt,
                "effects": {effect_id: effects_map[effect_id] for effect_id in selected},
            }
            manifest_bytes = (
                json.dumps(subset, ensure_ascii=False, indent=2) + "\n"
            ).encode("utf-8")
        else:
            manifest_bytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        archive.writestr("effects.json", manifest_bytes)
        for effect_id in selected:
            spec = effects_map[effect_id] or {}
            viewer = spec.get("viewer", "viewer.js")
            if isinstance(viewer, str) and viewer:
                key = f"{effect_id}/{viewer}"
                if key in staged:
                    archive.writestr(key, staged[key])
                else:
                    target = (_effects.EFFECTS_DIR / effect_id / viewer)
                    if target.is_file():
                        archive.writestr(key, target.read_bytes())
            if "console" in spec:
                console = spec.get("console", "console.js")
                if isinstance(console, str) and console:
                    key = f"{effect_id}/{console}"
                    if key in staged:
                        archive.writestr(key, staged[key])
                    else:
                        target = (_effects.EFFECTS_DIR / effect_id / console)
                        if target.is_file():
                            archive.writestr(key, target.read_bytes())
    logger.info("editor_export count=%d client=%s", len(selected), client)
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="effects.zip"',
            **NO_STORE,
        },
    )


@router.post("/api/editor/import")
async def import_effects(
    request: Request,
    file: UploadFile = File(...),
    dryRun: bool = Query(default=False),
    x_access_key: str | None = Header(default=None),
) -> dict:
    path = str(request.url.path)
    client = client_host(request)
    check_key(ACCESS_KEY, x_access_key, None, path=path, client=client)
    await editor_limiter.check(1, path=path, client=client)

    data = await file.read()
    if len(data) > IMPORT_MAX_BYTES:
        logger.warning("editor_import_rejected reason=too-large bytes=%d client=%s", len(data), client)
        raise HTTPException(status_code=413, detail="import file too large")

    _require_editable_manifest()
    imported_manifest, entries = _manifest_from_zip(data)
    if not isinstance(imported_manifest, dict) or imported_manifest.get("version") != 2:
        logger.error('editor_manifest_rejected error="imported manifest version must be 2" client=%s', client)
        raise HTTPException(status_code=400, detail="imported manifest version must be 2")
    imported_effects = imported_manifest.get("effects")
    if not isinstance(imported_effects, dict) or not imported_effects:
        logger.error('editor_manifest_rejected error="imported manifest must have a non-empty effects object" client=%s', client)
        raise HTTPException(
            status_code=400, detail="imported manifest must have a non-empty effects object"
        )
    for effect_id in imported_effects:
        if not EFFECT_ID_RE.fullmatch(str(effect_id)):
            logger.error('editor_manifest_rejected error="invalid effect id in zip" client=%s', client)
            raise HTTPException(status_code=400, detail="invalid effect id in zip")

    old_raw = _effects.MANIFEST
    old_ids = set((old_raw.get("effects") or {}).keys())
    created_ids = sorted(set(imported_effects) - old_ids)

    merged = deepcopy(old_raw)
    merged_effects = dict(merged.get("effects") or {})
    merged_effects.update(imported_effects)
    merged["effects"] = merged_effects
    imported_cur = imported_manifest.get("currentEffects")
    imported_alt = imported_manifest.get("alternateEffects")
    if isinstance(imported_cur, list) and isinstance(imported_alt, list):
        cur = list(merged.get("currentEffects") or [])
        alt = list(merged.get("alternateEffects") or [])
        cur_set = set(cur)
        alt_set = set(alt)
        imported_cur_set = set(imported_cur)
        imported_alt_set = set(imported_alt)
        for effect_id in imported_effects:
            if effect_id in imported_cur_set:
                if effect_id in alt_set:
                    alt.remove(effect_id)
                    alt_set.discard(effect_id)
                if effect_id not in cur_set:
                    cur.append(effect_id)
                    cur_set.add(effect_id)
            elif effect_id in imported_alt_set:
                if effect_id in cur_set:
                    cur.remove(effect_id)
                    cur_set.discard(effect_id)
                if effect_id not in alt_set:
                    alt.append(effect_id)
                    alt_set.add(effect_id)
        merged["currentEffects"] = cur
        merged["alternateEffects"] = alt

    files_to_write: dict[Path, bytes] = {}
    for effect_id, spec in imported_effects.items():
        directory = _effect_dir(effect_id)
        viewer = spec.get("viewer", "viewer.js")
        if isinstance(viewer, str) and viewer and "/" not in viewer:
            entry_name = f"{effect_id}/{viewer}"
            if entry_name in entries:
                files_to_write[directory / viewer] = entries[entry_name]
        if "console" in spec:
            console = spec.get("console", "console.js")
            if isinstance(console, str) and console and "/" not in console:
                entry_name = f"{effect_id}/{console}"
                if entry_name in entries:
                    files_to_write[directory / console] = entries[entry_name]
    for effect_id in created_ids:
        spec = imported_effects[effect_id]
        directory = _effect_dir(effect_id)
        viewer = spec.get("viewer", "viewer.js")
        if viewer == "viewer.js" and (directory / "viewer.js") not in files_to_write:
            files_to_write[directory / "viewer.js"] = VIEWER_TEMPLATE.replace(
                "__ID__", effect_id
            ).encode("utf-8")
        if "console" in spec and spec.get("console") == "console.js" and (
            directory / "console.js"
        ) not in files_to_write:
            files_to_write[directory / "console.js"] = CONSOLE_TEMPLATE.replace(
                "__ID__", effect_id
            ).encode("utf-8")

    if dryRun:
        base = _effects.EFFECTS_DIR.resolve()
        staged_files = {
            target.relative_to(base).as_posix(): data.decode("utf-8")
            for target, data in files_to_write.items()
        }
        layout = None
        if isinstance(imported_manifest.get("currentEffects"), list) and isinstance(
            imported_manifest.get("alternateEffects"), list
        ):
            layout = {
                "currentEffects": list(imported_manifest["currentEffects"]),
                "alternateEffects": list(imported_manifest["alternateEffects"]),
            }
        logger.info(
            "editor_import_dryrun effects=%d files=%d client=%s",
            len(imported_effects),
            len(staged_files),
            client,
        )
        return {
            "ok": True,
            "dryRun": True,
            "importedEffects": imported_effects,
            "importedLayout": layout,
            "files": staged_files,
            "baseRev": _effects.MANIFEST_REV,
        }

    original: dict[Path, bytes | None] = {}
    dirs_created: list[Path] = []
    for target in files_to_write:
        if not target.parent.exists():
            dirs_created.append(target.parent)
            target.parent.mkdir(parents=True, exist_ok=True)
        original[target] = target.read_bytes() if target.is_file() else None
    for target, data in files_to_write.items():
        _write_atomic(target, data)

    try:
        _validate_manifest(merged)
    except ManifestError as exc:
        _rollback_writes(original, dirs_created)
        logger.error('editor_manifest_rejected error="%s" client=%s', exc, client)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _write_manifest(merged, {p: b for p, b in original.items() if b is not None})
    new_effects, rev, changed = await asyncio.to_thread(reload_effects)
    if changed:
        _broadcast_manifest(rev, new_effects)
    for effect_id in created_ids:
        logger.info("editor_effect_created effect=%s client=%s", effect_id, client)
    logger.info(
        "editor_manifest_saved rev=%s changed=%s created=%d removed=0 client=%s",
        rev,
        str(changed).lower(),
        len(created_ids),
        client,
    )
    return {
        "ok": True,
        "changed": changed,
        "rev": rev,
        "created": created_ids,
        "effects": list(new_effects.keys()),
    }


@router.get("/editor")
async def editor_index():
    return file_response(EDITOR_DIR / "index.html", "text/html", "editor/index.html not found")


@router.get("/editor/")
async def editor_index_slash():
    return file_response(EDITOR_DIR / "index.html", "text/html", "editor/index.html not found")


@router.get("/editor/app.js")
async def editor_app_js():
    return file_response(EDITOR_DIR / "app.js", "application/javascript", "editor/app.js not found")


@router.get("/editor/style.css")
async def editor_style_css():
    return file_response(EDITOR_DIR / "style.css", "text/css", "editor/style.css not found")
