import hashlib
import json
import logging
import os
import re
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EFFECTS_DIR = ROOT / "effects"
MANIFEST_PATH = Path(os.environ.get("RTX_EFFECTS_MANIFEST", str(EFFECTS_DIR / "effects.json")))

EFFECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
PARAM_TYPES = {"integer", "number", "string", "color", "boolean", "select", "array"}
logger = logging.getLogger(__name__)


class ManifestError(ValueError):
    pass


def _validate_param_schema(effect_id: str, key: str, spec) -> None:
    if not isinstance(spec, dict):
        raise ManifestError(f"effect {effect_id}: param {key} must be an object")
    ptype = spec.get("type")
    if ptype not in PARAM_TYPES:
        raise ManifestError(f"effect {effect_id}: param {key} has invalid type {ptype!r}")
    if "default" not in spec:
        raise ManifestError(f"effect {effect_id}: param {key} missing default")
    if ptype == "select" and not isinstance(spec.get("options"), list):
        raise ManifestError(f"effect {effect_id}: param {key} select requires options")


def _is_enabled(spec: dict) -> bool:
    if "enabled" not in spec:
        return True
    return isinstance(spec["enabled"], bool) and spec["enabled"]


def _enabled_effect_ids(raw: dict) -> list[str]:
    return [effect_id for effect_id, spec in (raw.get("effects") or {}).items() if _is_enabled(spec)]


def _normalize_manifest_layout(raw: dict) -> dict[str, list[str]]:
    effects = raw.get("effects") or {}
    enabled_ids = _enabled_effect_ids(raw)
    version = raw.get("version")
    if version == 1:
        if "currentEffects" in raw or "alternateEffects" in raw:
            raise ManifestError("manifest version 1 must not define currentEffects/alternateEffects")
        return {"current": enabled_ids[:], "alternate": []}

    raw_current = raw.get("currentEffects")
    raw_alternate = raw.get("alternateEffects")
    if not isinstance(raw_current, list) or not all(isinstance(effect_id, str) for effect_id in raw_current):
        raise ManifestError("currentEffects must be an array of effect IDs")
    if not isinstance(raw_alternate, list) or not all(isinstance(effect_id, str) for effect_id in raw_alternate):
        raise ManifestError("alternateEffects must be an array of effect IDs")
    if len(raw_current) != len(set(raw_current)):
        raise ManifestError("currentEffects contains duplicate IDs")
    if len(raw_alternate) != len(set(raw_alternate)):
        raise ManifestError("alternateEffects contains duplicate IDs")
    for effect_id in raw_current:
        if effect_id not in effects:
            raise ManifestError(f"currentEffects contains unknown effect: {effect_id}")
    for effect_id in raw_alternate:
        if effect_id not in effects:
            raise ManifestError(f"alternateEffects contains unknown effect: {effect_id}")
    overlap = set(raw_current) & set(raw_alternate)
    if overlap:
        raise ManifestError("currentEffects and alternateEffects cannot share IDs")

    enabled_set = set(enabled_ids)
    for effect_id in raw_current:
        if effect_id not in enabled_set:
            logger.warning("currentEffects contains disabled effect %s; excluded from layout", effect_id)
    for effect_id in raw_alternate:
        if effect_id not in enabled_set:
            logger.warning("alternateEffects contains disabled effect %s; excluded from layout", effect_id)

    current: list[str] = []
    for effect_id in raw_current:
        if effect_id in enabled_set and effect_id not in current:
            current.append(effect_id)
    alternate: list[str] = []
    for effect_id in raw_alternate:
        if effect_id in enabled_set and effect_id not in current and effect_id not in alternate:
            alternate.append(effect_id)
    for effect_id in enabled_ids:
        if effect_id not in current and effect_id not in alternate:
            alternate.append(effect_id)
    return {"current": current, "alternate": alternate}


def _validate_manifest(raw) -> dict[str, list[str]]:
    if not isinstance(raw, dict):
        raise ManifestError("manifest must be an object")
    version = raw.get("version")
    if isinstance(version, bool) or version not in (1, 2):
        raise ManifestError("manifest version must be 1 or 2")
    effects = raw.get("effects")
    if not isinstance(effects, dict) or not effects:
        raise ManifestError("manifest must have a non-empty effects object")
    for effect_id, spec in effects.items():
        if not EFFECT_ID_RE.fullmatch(effect_id):
            raise ManifestError(f"invalid effect id: {effect_id!r}")
        if not isinstance(spec, dict):
            raise ManifestError(f"effect {effect_id} must be an object")
        if "enabled" in spec and not isinstance(spec["enabled"], bool):
            raise ManifestError(f"effect {effect_id}: enabled must be a boolean")
        enabled = _is_enabled(spec)
        viewer = spec.get("viewer", "viewer.js")
        if not isinstance(viewer, str) or viewer != viewer.strip() or "/" in viewer or viewer != Path(viewer).name:
            raise ManifestError(f"effect {effect_id}: invalid viewer filename {viewer!r}")
        if enabled and not (EFFECTS_DIR / effect_id / viewer).is_file():
            raise ManifestError(f"effect {effect_id}: missing viewer file effects/{effect_id}/{viewer}")
        console = spec.get("console", "console.js")
        if not isinstance(console, str) or "/" in console or console != Path(console).name:
            raise ManifestError(f"effect {effect_id}: invalid console filename {console!r}")
        params = spec.get("params") or {}
        if not isinstance(params, dict):
            raise ManifestError(f"effect {effect_id}: params must be an object")
        for key, spec_ in params.items():
            _validate_param_schema(effect_id, key, spec_)
    return _normalize_manifest_layout(raw)


def _sanitize_effect(effect_id: str, spec: dict) -> dict:
    viewer = spec.get("viewer", "viewer.js")
    entry = {
        "label": spec.get("label") or effect_id,
    }
    if "category" in spec:
        entry["category"] = spec["category"]
    if "icon" in spec:
        entry["icon"] = spec["icon"]
    entry["viewerUrl"] = f"/effects/{effect_id}/{viewer}"
    console = spec.get("console", "console.js")
    console_path = EFFECTS_DIR / effect_id / console
    entry["consoleUrl"] = f"/effects/{effect_id}/{console}" if console_path.is_file() else None
    entry["params"] = spec.get("params") or {}
    return entry


def load_manifest() -> dict:
    try:
        raw = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestError(f"cannot read {MANIFEST_PATH}: {exc}") from exc
    layout = _validate_manifest(raw)
    return raw, layout


MANIFEST: dict = {}
EFFECTS: dict[str, dict] = {}
MANIFEST_REV: str = ""
MANIFEST_VERSION: int = 1
MANIFEST_CURRENT_EFFECTS: list[str] = []
MANIFEST_ALTERNATE_EFFECTS: list[str] = []
_MANIFEST_LOCK = threading.RLock()


def _file_hash(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def _catalog_fingerprint(
    raw: dict,
    manifest_hash: str | None,
    version: int,
    enabled_ids: list[str],
    layout: dict[str, list[str]],
) -> str:
    effects = raw.get("effects") or {}
    parts: list[str] = [
        str(version),
        manifest_hash or "missing",
        json.dumps(layout, sort_keys=True, ensure_ascii=False),
        json.dumps(enabled_ids, ensure_ascii=False),
    ]
    for effect_id in enabled_ids:
        spec = effects.get(effect_id) or {}
        viewer = spec.get("viewer", "viewer.js")
        parts.append(str(effect_id))
        parts.append(str(viewer))
        parts.append(_file_hash(EFFECTS_DIR / effect_id / viewer) or "missing")
        console = spec.get("console", "console.js")
        if isinstance(console, str) and console:
            parts.append(str(console))
            console_path = EFFECTS_DIR / effect_id / console
            if console_path.is_file():
                parts.append(_file_hash(console_path) or "unreadable")
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def _load_catalog() -> tuple[dict, str, int, list[str], dict[str, list[str]]]:
    manifest_hash = _file_hash(MANIFEST_PATH)
    raw, layout = load_manifest()
    version = raw.get("version")
    enabled_ids = _enabled_effect_ids(raw)
    rev = _catalog_fingerprint(raw, manifest_hash, version, enabled_ids, layout)
    return raw, rev, version, enabled_ids, layout


def _apply_catalog(
    raw: dict,
    rev: str,
    version: int,
    enabled_ids: list[str],
    layout: dict[str, list[str]],
) -> None:
    global MANIFEST_REV
    global MANIFEST_VERSION
    global MANIFEST_CURRENT_EFFECTS
    global MANIFEST_ALTERNATE_EFFECTS
    effects = raw.get("effects") or {}
    next_effects = {
        effect_id: _sanitize_effect(effect_id, effects[effect_id])
        for effect_id in enabled_ids
    }
    MANIFEST.clear()
    MANIFEST.update(raw)
    EFFECTS.clear()
    EFFECTS.update(next_effects)
    MANIFEST_REV = rev
    MANIFEST_VERSION = version
    MANIFEST_CURRENT_EFFECTS = layout["current"][:]
    MANIFEST_ALTERNATE_EFFECTS = layout["alternate"][:]


def _initialize_catalog() -> None:
    with _MANIFEST_LOCK:
        raw, rev, version, enabled_ids, layout = _load_catalog()
        _apply_catalog(raw, rev, version, enabled_ids, layout)


def reload_effects() -> tuple[dict, str, bool]:
    with _MANIFEST_LOCK:
        raw, rev, version, enabled_ids, layout = _load_catalog()
        if rev == MANIFEST_REV:
            return dict(EFFECTS), MANIFEST_REV, False
        _apply_catalog(raw, rev, version, enabled_ids, layout)
        return dict(EFFECTS), MANIFEST_REV, True


_initialize_catalog()
