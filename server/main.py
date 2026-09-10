import asyncio
import copy
import json
import math
import os
import re
import time
import uuid
from collections import deque
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from server.effects import EFFECTS, EFFECTS_DIR, EFFECT_ID_RE, MANIFEST_PATH

ROOT = Path(__file__).resolve().parent.parent
VIEWER_APP_JS = ROOT / "viewer" / "app.js"
VIEWER_EFFECTS_JS = ROOT / "viewer" / "effects.js"
CONSOLE_APP_JS = ROOT / "console" / "app.js"
CONSOLE_ICONS_JS = ROOT / "console" / "icons.js"
CONSOLE_CSS = ROOT / "console" / "style.css"
EXAMPLES_DIR = ROOT / "examples"

_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

ACCESS_KEY = os.getenv("ACCESS_KEY", "").strip()

RATE_LIMIT_PER_SEC = 20

NO_STORE = {"Cache-Control": "no-store"}

app = FastAPI(title="Real-time Interaction relay")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_subscribers: set[asyncio.Queue] = set()
_rate_window: deque[float] = deque()
_rate_lock = asyncio.Lock()


def _check_key(header_key: str | None, query_key: str | None) -> None:
    if not ACCESS_KEY:
        return
    if header_key != ACCESS_KEY and query_key != ACCESS_KEY:
        raise HTTPException(status_code=401, detail="invalid access key")


async def _rate_limit() -> None:
    now = time.monotonic()
    async with _rate_lock:
        while _rate_window and now - _rate_window[0] > 1.0:
            _rate_window.popleft()
        if len(_rate_window) >= RATE_LIMIT_PER_SEC:
            raise HTTPException(status_code=429, detail="rate limit exceeded", headers={"Retry-After": "1"})
        _rate_window.append(now)


def _broadcast(msg: dict) -> None:
    for q in _subscribers:
        q.put_nowait(msg)


def _to_number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            return None
    else:
        return None
    if not math.isfinite(number):
        return None
    return number


def _normalize_value(schema: dict, value):
    default = schema.get("default")
    ptype = schema.get("type")
    if ptype in ("integer", "number"):
        number = _to_number(value)
        if number is None:
            return copy.deepcopy(default)
        if ptype == "integer":
            number = int(round(number))
        lo = schema.get("min")
        hi = schema.get("max")
        if lo is not None and number < lo:
            number = lo
        if hi is not None and number > hi:
            number = hi
        if ptype == "integer":
            number = int(number)
        return number
    if ptype == "string":
        if not isinstance(value, str):
            return copy.deepcopy(default)
        max_length = schema.get("maxLength")
        if max_length is not None and len(value) > max_length:
            value = value[:max_length]
        return value
    if ptype == "color":
        if isinstance(value, str) and _COLOR_RE.fullmatch(value):
            return value
        return copy.deepcopy(default)
    if ptype == "boolean":
        if isinstance(value, bool):
            return value
        return copy.deepcopy(default)
    if ptype == "select":
        for option in schema.get("options") or []:
            if isinstance(option, dict) and option.get("value") == value:
                return value
        return copy.deepcopy(default)
    if ptype == "array":
        if not isinstance(value, list):
            return copy.deepcopy(default)
        min_items = schema.get("minItems")
        max_items = schema.get("maxItems")
        if min_items is not None and len(value) < min_items:
            return copy.deepcopy(default)
        if max_items is not None and len(value) > max_items:
            value = value[:max_items]
        item_type = schema.get("items")
        if not item_type:
            return value
        return [_normalize_value({"type": item_type, "default": None}, item) for item in value]
    return copy.deepcopy(default)


def normalize_params(effect_id: str, raw: dict) -> dict:
    schema = (EFFECTS.get(effect_id) or {}).get("params") or {}
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for key, spec in schema.items():
        if spec.get("editable") is False:
            out[key] = copy.deepcopy(spec.get("default"))
        elif key not in raw:
            out[key] = copy.deepcopy(spec.get("default"))
        else:
            out[key] = _normalize_value(spec, raw[key])
    return out


class EffectRequest(BaseModel):
    effect: str
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)
    params: dict = Field(default_factory=dict)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "ts": int(time.time())}


@app.get("/api/effects")
async def list_effects() -> dict:
    return {"effects": EFFECTS}


@app.post("/api/effect")
async def post_effect(
    body: EffectRequest,
    x_access_key: str | None = Header(default=None),
    key: str | None = Query(default=None),
) -> dict:
    _check_key(x_access_key, key)
    if body.effect not in EFFECTS:
        raise HTTPException(status_code=400, detail=f"unknown effect: {body.effect}")
    await _rate_limit()
    msg = {
        "id": str(uuid.uuid4()),
        "type": "effect",
        "effect": body.effect,
        "x": body.x,
        "y": body.y,
        "params": normalize_params(body.effect, body.params),
        "ts": int(time.time()),
    }
    _broadcast(msg)
    return {"ok": True, "id": msg["id"]}


@app.post("/api/clear")
async def post_clear(
    x_access_key: str | None = Header(default=None),
    key: str | None = Query(default=None),
) -> dict:
    _check_key(x_access_key, key)
    await _rate_limit()
    msg = {"id": str(uuid.uuid4()), "type": "clear", "ts": int(time.time())}
    _broadcast(msg)
    return {"ok": True, "id": msg["id"]}


@app.get("/api/stream")
async def stream(
    request: Request,
    key: str | None = Query(default=None),
):
    _check_key(None, key)
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)

    async def generate():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield f"event: ping\ndata: {json.dumps({'ts': int(time.time())})}\n\n"
                    continue
                yield f"event: {msg['type']}\ndata: {json.dumps(msg, ensure_ascii=False)}\n\n"
        finally:
            _subscribers.discard(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _file_response(path: Path, media_type: str, detail: str):
    if not path.exists():
        raise HTTPException(status_code=404, detail=detail)
    return FileResponse(path, media_type=media_type, headers=NO_STORE)


@app.get("/viewer/app.js")
async def viewer_app_js():
    return _file_response(VIEWER_APP_JS, "application/javascript", "viewer/app.js not found")


@app.get("/viewer/effects.js")
async def viewer_effects_js():
    return _file_response(VIEWER_EFFECTS_JS, "application/javascript", "viewer/effects.js not found")


@app.get("/console/app.js")
async def console_app_js():
    return _file_response(CONSOLE_APP_JS, "application/javascript", "console/app.js not found")


@app.get("/console/icons.js")
async def console_icons_js():
    return _file_response(CONSOLE_ICONS_JS, "application/javascript", "console/icons.js not found")


@app.get("/console/style.css")
async def console_style_css():
    return _file_response(CONSOLE_CSS, "text/css", "console/style.css not found")


@app.get("/effects/effects.json")
async def effects_manifest():
    return _file_response(MANIFEST_PATH, "application/json", "effects/effects.json not found")


def _effect_asset(effect_id: str, filename: str):
    if not EFFECT_ID_RE.fullmatch(effect_id):
        raise HTTPException(status_code=404, detail="not found")
    target = (EFFECTS_DIR / effect_id / filename).resolve()
    base = EFFECTS_DIR.resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(target, media_type="application/javascript", headers=NO_STORE)


@app.get("/effects/{effect_id}/viewer.js")
async def effect_viewer_js(effect_id: str):
    return _effect_asset(effect_id, "viewer.js")


@app.get("/effects/{effect_id}/console.js")
async def effect_console_js(effect_id: str):
    return _effect_asset(effect_id, "console.js")


def _examples_enabled() -> bool:
    return os.getenv("SERVE_EXAMPLES", "").strip().lower() in {"1", "true", "yes"}


def _examples_response(path: str):
    if not _examples_enabled():
        raise HTTPException(status_code=404, detail="examples not enabled")
    rel = "index.html" if path in ("", "index.html") else path
    target = (EXAMPLES_DIR / rel).resolve()
    base = EXAMPLES_DIR.resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="examples file not found")
    return FileResponse(target, headers={"Cache-Control": "no-store"})


@app.get("/examples")
@app.get("/examples/")
async def examples_index():
    return _examples_response("index.html")


@app.get("/examples/{path:path}")
async def examples_file(path: str):
    return _examples_response(path)
