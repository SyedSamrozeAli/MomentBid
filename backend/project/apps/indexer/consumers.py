"""Django Channels WebSocket consumer for per-match real-time events."""

from __future__ import annotations

import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer


logger = logging.getLogger(__name__)


class MatchConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = f"match_{match_id}"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except Exception:  # noqa: BLE001
            logger.exception("WebSocket connect failed for match_id=%s", match_id)
            await self.close(code=1011)
            return
        await self.accept()

    async def disconnect(self, code: int) -> None:
        try:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception:  # noqa: BLE001
            logger.exception(
                "WebSocket disconnect cleanup failed for group=%s code=%s",
                getattr(self, "group_name", "unknown"),
                code,
            )

    async def match_event(self, event: dict) -> None:
        """Handler called by channel layer group_send with type='match_event'."""
        await self.send_json(event["data"])
