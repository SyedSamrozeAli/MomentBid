"""Push real-time events to connected WebSocket clients via Django Channels."""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import Future
from threading import Lock, Thread

from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

_background_loop: asyncio.AbstractEventLoop | None = None
_background_thread: Thread | None = None
_background_lock = Lock()


def _log_future_exception(future: Future | asyncio.Task) -> None:
    """Log any exception raised by asynchronous send tasks."""
    try:
        future.result()
    except Exception as exc:  # noqa: BLE001
        logger.warning("WebSocket push skipped (channel layer unavailable): %s", exc)


def _run_background_loop(loop: asyncio.AbstractEventLoop) -> None:
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _ensure_background_loop() -> asyncio.AbstractEventLoop:
    """Create a process-wide event loop for sync callers when needed."""
    global _background_loop, _background_thread

    if _background_loop is not None and _background_loop.is_running():
        return _background_loop

    with _background_lock:
        if _background_loop is not None and _background_loop.is_running():
            return _background_loop

        loop = asyncio.new_event_loop()
        thread = Thread(
            target=_run_background_loop,
            args=(loop,),
            name="match-push-loop",
            daemon=True,
        )
        thread.start()
        _background_loop = loop
        _background_thread = thread
        return loop


async def _push_match_event_async(
    match_id: int, event_name: str, payload: dict
) -> None:
    """Send a match event over the configured channel layer in async context."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    await channel_layer.group_send(
        f"match_{match_id}",
        {
            "type": "match_event",
            "data": {"event": event_name, "payload": payload},
        },
    )


def push_match_event(match_id: int, event_name: str, payload: dict) -> None:
    """Broadcast an event to all clients subscribed to a match channel.

    Silently skips if channel layer unavailable — callers should not crash
    just because the WebSocket layer is down.

    RabbitMQ channel layer requires a running event loop for initialization,
    so we ensure dispatch runs in async context even when called from sync views.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        try:
            background_loop = _ensure_background_loop()
            future = asyncio.run_coroutine_threadsafe(
                _push_match_event_async(match_id, event_name, payload),
                background_loop,
            )
            future.add_done_callback(_log_future_exception)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "WebSocket push skipped (channel layer unavailable): %s", exc
            )
        return

    try:
        task = loop.create_task(_push_match_event_async(match_id, event_name, payload))
        task.add_done_callback(_log_future_exception)
    except Exception as exc:  # noqa: BLE001
        logger.warning("WebSocket push skipped (channel layer unavailable): %s", exc)
