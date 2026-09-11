import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EFFECTS_DIR = ROOT / "effects"
MANIFEST_PATH = Path(os.environ.get("RTX_EFFECTS_MANIFEST", str(EFFECTS_DIR / "effects.json")))

EFFECT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
PARAM_TYPES = {"integer", "number", "string", "color", "boolean", "select", "array"}


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


def _validate_manifest(raw) -> None:
    if not isinstance(raw, dict):
        raise ManifestError("manifest must be an object")
    if raw.get("version") != 1:
        raise ManifestError("manifest version must be 1")
    effects = raw.get("effects")
    if not isinstance(effects, dict) or not effects:
        raise ManifestError("manifest must have a non-empty effects object")
    for effect_id, spec in effects.items():
        if not EFFECT_ID_RE.fullmatch(effect_id):
            raise ManifestError(f"invalid effect id: {effect_id!r}")
        if not isinstance(spec, dict):
            raise ManifestError(f"effect {effect_id} must be an object")
        viewer = spec.get("viewer", "viewer.js")
        if not isinstance(viewer, str) or viewer != viewer.strip() or "/" in viewer or viewer != Path(viewer).name:
            raise ManifestError(f"effect {effect_id}: invalid viewer filename {viewer!r}")
        if not (EFFECTS_DIR / effect_id / viewer).is_file():
            raise ManifestError(f"effect {effect_id}: missing viewer file effects/{effect_id}/{viewer}")
        console = spec.get("console", "console.js")
        if not isinstance(console, str) or "/" in console or console != Path(console).name:
            raise ManifestError(f"effect {effect_id}: invalid console filename {console!r}")
        params = spec.get("params") or {}
        if not isinstance(params, dict):
            raise ManifestError(f"effect {effect_id}: params must be an object")
        for key, spec_ in params.items():
            _validate_param_schema(effect_id, key, spec_)


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
    _validate_manifest(raw)
    return raw


MANIFEST = load_manifest()

EFFECTS: dict[str, dict] = {
    effect_id: _sanitize_effect(effect_id, spec) for effect_id, spec in MANIFEST["effects"].items()
}
