import asyncio
import json
import os
import time
import uuid
from collections import deque
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from server.effects import EFFECTS

ROOT = Path(__file__).resolve().parent.parent
SHARED_APP_JS = ROOT / "shared" / "app.js"
VIEWER_EFFECTS_JS = ROOT / "viewer" / "effects.js"
CONSOLE_APP_JS = ROOT / "console" / "app.js"
CONSOLE_CSS = ROOT / "console" / "style.css"

ACCESS_KEY = os.getenv("ACCESS_KEY", "").strip()

RATE_LIMIT_PER_SEC = 20

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
            raise HTTPException(status_code=429, detail="rate limit exceeded")
        _rate_window.append(now)


def _broadcast(msg: dict) -> None:
    for q in _subscribers:
        q.put_nowait(msg)


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
        "params": body.params,
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
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


NO_STORE = {"Cache-Control": "no-store"}


@app.get("/app.js")
async def app_js():
    if not SHARED_APP_JS.exists():
        raise HTTPException(status_code=404, detail="shared/app.js not found")
    return FileResponse(SHARED_APP_JS, media_type="application/javascript", headers=NO_STORE)


@app.get("/effects.js")
async def effects_js():
    if not VIEWER_EFFECTS_JS.exists():
        raise HTTPException(status_code=404, detail="viewer/effects.js not found")
    return FileResponse(VIEWER_EFFECTS_JS, media_type="application/javascript", headers=NO_STORE)


@app.get("/console.js")
async def console_js():
    if not CONSOLE_APP_JS.exists():
        raise HTTPException(status_code=404, detail="console/app.js not found")
    return FileResponse(CONSOLE_APP_JS, media_type="application/javascript", headers=NO_STORE)


@app.get("/console.css")
async def console_css():
    if not CONSOLE_CSS.exists():
        raise HTTPException(status_code=404, detail="console/style.css not found")
    return FileResponse(CONSOLE_CSS, media_type="text/css", headers=NO_STORE)
