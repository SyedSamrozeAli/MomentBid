"""Push real-time events to connected WebSocket clients via Django Channels."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def push_match_event(match_id: int, event_name: str, payload: dict) -> None:
    """Broadcast an event to all clients subscribed to a match channel."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"match_{match_id}",
        {
            "type": "match_event",
            "data": {"event": event_name, "payload": payload},
        },
    )
