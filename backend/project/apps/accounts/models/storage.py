from __future__ import annotations

from pathlib import Path

from django.utils import timezone


def _timestamp() -> str:
    return timezone.now().strftime("%Y%m%d%H%M%S")


def brand_logo_upload_path(instance, filename: str) -> str:
    ext = Path(filename).suffix or ".png"
    return f"brands/{instance.pk or 'temp'}/logo_{_timestamp()}{ext}"


def broadcaster_logo_upload_path(instance, filename: str) -> str:
    ext = Path(filename).suffix or ".png"
    return f"broadcasters/{instance.pk or 'temp'}/logo_{_timestamp()}{ext}"


def user_profile_upload_path(instance, filename: str) -> str:
    ext = Path(filename).suffix or ".png"
    return f"users/{instance.pk or 'temp'}/profile_{_timestamp()}{ext}"
