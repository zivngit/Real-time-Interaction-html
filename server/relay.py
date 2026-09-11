import asyncio
import json
import time
from collections import deque

from fastapi import HTTPException

_subscribers: set[asyncio.Queue] = set()


def add_subscriber(queue: asyncio.Queue) -> None:
    _subscribers.add(queue)


def remove_subscriber(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


def broadcast(msg: dict) -> None:
    for queue in _subscribers:
        queue.put_nowait(msg)


class RateLimiter:
    def __init__(self) -> None:
        self.window: deque[float] = deque()
        self.lock = asyncio.Lock()

    def reset(self) -> None:
        self.window.clear()

    async def check(self, limit_per_sec: int) -> None:
        now = time.monotonic()
        async with self.lock:
            while self.window and now - self.window[0] > 1.0:
                self.window.popleft()
            if len(self.window) >= limit_per_sec:
                raise HTTPException(
                    status_code=429,
                    detail="rate limit exceeded",
                    headers={"Retry-After": "1"},
                )
            self.window.append(now)


async def event_stream(queue: asyncio.Queue, is_disconnected):
    try:
        yield "retry: 3000\n\n"
        while True:
            if await is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                yield f"event: ping\ndata: {json.dumps({'ts': int(time.time())})}\n\n"
                continue
            yield f"event: {msg['type']}\ndata: {json.dumps(msg, ensure_ascii=False)}\n\n"
    finally:
        remove_subscriber(queue)
