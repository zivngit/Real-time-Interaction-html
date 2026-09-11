import asyncio
import time
import uuid

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from server.config import ACCESS_KEY, RATE_LIMIT_PER_SEC
from server.effects import EFFECTS, MANIFEST_PATH
from server.params import normalize_params
from server.relay import RateLimiter, add_subscriber, broadcast, event_stream
from server.security import check_key
from server.static_files import (
    CONSOLE_APP_JS,
    CONSOLE_CSS,
    CONSOLE_ICONS_JS,
    VIEWER_APP_JS,
    VIEWER_EFFECTS_JS,
    effect_asset,
    examples_response,
    file_response,
)

app = FastAPI(title="Real-time Interaction relay")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

rate_limiter = RateLimiter()


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
    check_key(ACCESS_KEY, x_access_key, key)
    if body.effect not in EFFECTS:
        raise HTTPException(status_code=400, detail=f"unknown effect: {body.effect}")
    await rate_limiter.check(RATE_LIMIT_PER_SEC)
    msg = {
        "id": str(uuid.uuid4()),
        "type": "effect",
        "effect": body.effect,
        "x": body.x,
        "y": body.y,
        "params": normalize_params(body.effect, body.params, EFFECTS),
        "ts": int(time.time()),
    }
    broadcast(msg)
    return {"ok": True, "id": msg["id"]}


@app.post("/api/clear")
async def post_clear(
    x_access_key: str | None = Header(default=None),
    key: str | None = Query(default=None),
) -> dict:
    check_key(ACCESS_KEY, x_access_key, key)
    await rate_limiter.check(RATE_LIMIT_PER_SEC)
    msg = {"id": str(uuid.uuid4()), "type": "clear", "ts": int(time.time())}
    broadcast(msg)
    return {"ok": True, "id": msg["id"]}


@app.get("/api/stream")
async def stream(
    request: Request,
    key: str | None = Query(default=None),
):
    check_key(ACCESS_KEY, None, key)
    queue: asyncio.Queue = asyncio.Queue()
    add_subscriber(queue)
    return StreamingResponse(
        event_stream(queue, request.is_disconnected),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/viewer/app.js")
async def viewer_app_js():
    return file_response(VIEWER_APP_JS, "application/javascript", "viewer/app.js not found")


@app.get("/viewer/effects.js")
async def viewer_effects_js():
    return file_response(VIEWER_EFFECTS_JS, "application/javascript", "viewer/effects.js not found")


@app.get("/console/app.js")
async def console_app_js():
    return file_response(CONSOLE_APP_JS, "application/javascript", "console/app.js not found")


@app.get("/console/icons.js")
async def console_icons_js():
    return file_response(CONSOLE_ICONS_JS, "application/javascript", "console/icons.js not found")


@app.get("/console/style.css")
async def console_style_css():
    return file_response(CONSOLE_CSS, "text/css", "console/style.css not found")


@app.get("/effects/effects.json")
async def effects_manifest():
    return file_response(MANIFEST_PATH, "application/json", "effects/effects.json not found")


@app.get("/effects/{effect_id}/viewer.js")
async def effect_viewer_js(effect_id: str):
    return effect_asset(effect_id, "viewer.js")


@app.get("/effects/{effect_id}/console.js")
async def effect_console_js(effect_id: str):
    return effect_asset(effect_id, "console.js")


@app.get("/examples")
@app.get("/examples/")
async def examples_index():
    return examples_response("index.html")


@app.get("/examples/{path:path}")
async def examples_file(path: str):
    return examples_response(path)
