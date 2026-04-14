from apps.accounts.models.brands import WalletProtectedOrganization
from apps.accounts.models.storage import broadcaster_logo_upload_path
from django.db import models


class Broadcaster(WalletProtectedOrganization):
    """Organization creating matches and event inventory."""

    logo = models.ImageField(
        upload_to=broadcaster_logo_upload_path, null=True, blank=True
    )

    def __str__(self) -> str:
        return self.name
