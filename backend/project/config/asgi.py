"""ASGI config for MomentBid backend — HTTP + WebSocket via Django Channels."""

import os
import sys
from pathlib import Path

import django
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application


def _ensure_project_root_on_path() -> None:
    project_root = Path(__file__).resolve().parent.parent
    project_root_str = str(project_root)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)


def _default_settings_module() -> str:
    package = __package__ or "config"
    return f"{package}.settings"


_ensure_project_root_on_path()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", _default_settings_module())
django.setup()

from apps.indexer.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
