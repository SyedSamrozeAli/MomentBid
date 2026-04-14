"""WebSocket URL patterns for Django Channels routing."""

from django.urls import re_path

from apps.indexer.consumers import MatchConsumer

websocket_urlpatterns = [
    re_path(r"ws/matches/(?P<match_id>\d+)/$", MatchConsumer.as_asgi()),
]
