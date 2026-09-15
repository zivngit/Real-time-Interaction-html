import asyncio
import json
import logging
import time
from collections import deque

from fastapi import HTTPException

logger = logging.getLogger(__name__)

PING_TIMEOUT = 15

_subscribers: set[asyncio.Queue] = set()


def add_subscriber(queue: asyncio.Queue) -> None:
    _subscribers.add(queue)


def remove_subscriber(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def subscriber_count() -> int:
    return len(_subscribers)


def broadcast(msg: dict) -> None:
    for queue in _subscribers:
        queue.put_nowait(msg)
    if msg.get("type") == "effect":
        logger.info(
            "effect_broadcast id=%s effect=%s x=%s y=%s subscribers=%d",
            msg.get("id"),
            msg.get("effect"),
            msg.get("x"),
            msg.get("y"),
            len(_subscribers),
        )
    elif msg.get("type") == "clear":
        logger.info("clear_broadcast id=%s subscribers=%d", msg.get("id"), len(_subscribers))
    elif msg.get("type") == "manifest":
        logger.info(
            "manifest_broadcast id=%s rev=%s subscribers=%d", msg.get("id"), msg.get("rev"), len(_subscribers)
        )


class RateLimiter:
    def __init__(self) -> None:
        self.window: deque[float] = deque()
        self.lock = asyncio.Lock()

    def reset(self) -> None:
        self.window.clear()

    async def check(self, limit_per_sec: int, *, path: str | None = None, client: str | None = None) -> None:
        now = time.monotonic()
        async with self.lock:
            while self.window and now - self.window[0] > 1.0:
                self.window.popleft()
            if len(self.window) >= limit_per_sec:
                logger.warning("rate_limited path=%s client=%s limit=%d", path, client, limit_per_sec)
                raise HTTPException(
                    status_code=429,
                    detail="rate limit exceeded",
                    headers={"Retry-After": "1"},
                )
            self.window.append(now)


async def event_stream(queue: asyncio.Queue, is_disconnected, client=None):
    try:
        logger.info("sse_connected subscribers=%d client=%s", len(_subscribers), client or "unknown")
        yield "retry: 3000\n\n"
        while True:
            if await is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=PING_TIMEOUT)
            except asyncio.TimeoutError:
                logger.debug("sse_ping subscribers=%d", len(_subscribers))
                yield f"event: ping\ndata: {json.dumps({'ts': int(time.time())})}\n\n"
                continue
            yield f"event: {msg['type']}\ndata: {json.dumps(msg, ensure_ascii=False)}\n\n"
    finally:
        remove_subscriber(queue)
        logger.info("sse_disconnected subscribers=%d client=%s", len(_subscribers), client or "unknown")
