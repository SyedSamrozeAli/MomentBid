"""Django Channels WebSocket consumer for per-match real-time events."""

from __future__ import annotations

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class MatchConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self) -> None:
        match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = f"match_{match_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code: int) -> None:
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def match_event(self, event: dict) -> None:
        """Handler called by channel layer group_send with type='match_event'."""
        await self.send_json(event["data"])
