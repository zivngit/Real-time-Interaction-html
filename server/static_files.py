import logging
import os
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, Response

from server.effects import EFFECTS_DIR, EFFECT_ID_RE

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
VIEWER_APP_JS = ROOT / "viewer" / "app.js"
VIEWER_EFFECTS_JS = ROOT / "viewer" / "effects.js"
CONSOLE_APP_JS = ROOT / "console" / "app.js"
CONSOLE_ICONS_JS = ROOT / "console" / "icons.js"
CONSOLE_CSS = ROOT / "console" / "style.css"
EXAMPLES_DIR = ROOT / "examples"

NO_STORE = {"Cache-Control": "no-store"}
NO_CACHE = {"Cache-Control": "no-cache"}


def _etag_matches(if_none_match: str, etag: str) -> bool:
    if if_none_match == "*":
        return True
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate == etag or candidate == f"W/{etag}":
            return True
    return False


def _conditional(response: FileResponse, request: Request | None):
    if request is None:
        return response
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and _etag_matches(if_none_match, response.headers["etag"]):
        return Response(status_code=304, headers={"etag": response.headers["etag"], **NO_CACHE})
    return response


def file_response(path: Path, media_type: str, detail: str, request: Request | None = None):
    if not path.is_file():
        raise HTTPException(status_code=404, detail=detail)
    response = FileResponse(path, media_type=media_type, headers=NO_CACHE, stat_result=os.stat(path))
    return _conditional(response, request)


def effect_asset(effect_id: str, filename: str, client: str | None = None, request: Request | None = None):
    path = f"/effects/{effect_id}/{filename}"
    if not EFFECT_ID_RE.fullmatch(effect_id):
        logger.warning("asset_missing path=%s client=%s", path, client or "unknown")
        raise HTTPException(status_code=404, detail="not found")
    target = (EFFECTS_DIR / effect_id / filename).resolve()
    base = EFFECTS_DIR.resolve()
    if not target.is_relative_to(base) or not target.is_file():
        logger.warning("asset_missing path=%s client=%s", path, client or "unknown")
        raise HTTPException(status_code=404, detail="not found")
    response = FileResponse(target, media_type="application/javascript", headers=NO_CACHE, stat_result=os.stat(target))
    return _conditional(response, request)


def examples_enabled() -> bool:
    return os.getenv("SERVE_EXAMPLES", "").strip().lower() in {"1", "true", "yes"}


def examples_response(path: str):
    if not examples_enabled():
        raise HTTPException(status_code=404, detail="examples not enabled")
    rel = "index.html" if path in ("", "index.html") else path
    target = (EXAMPLES_DIR / rel).resolve()
    base = EXAMPLES_DIR.resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="examples file not found")
    return FileResponse(target, headers={"Cache-Control": "no-store"})
