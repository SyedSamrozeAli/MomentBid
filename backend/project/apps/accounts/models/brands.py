from __future__ import annotations

from typing import Final

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models

from apps.accounts.models.storage import brand_logo_upload_path

ADDRESS_LENGTH: Final[int] = 42


class WalletProtectedOrganization(models.Model):
    """Base model for organizations owning a managed custodial wallet."""

    name = models.CharField(max_length=255, unique=True)
    wallet_address = models.CharField(
        max_length=ADDRESS_LENGTH, unique=True, blank=True
    )
    encrypted_private_key = models.BinaryField(null=True, blank=True)
    wire_funded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

    @staticmethod
    def _get_fernet() -> Fernet:
        raw_key = settings.WALLET_ENCRYPTION_KEY
        if not raw_key:
            raise ValueError("WALLET_ENCRYPTION_KEY is not configured")
        if isinstance(raw_key, str) and raw_key.startswith("<"):
            raise ValueError(
                "WALLET_ENCRYPTION_KEY must be a real Fernet key, not a placeholder"
            )

        key_bytes = raw_key.encode("utf-8") if isinstance(raw_key, str) else raw_key
        return Fernet(key_bytes)

    def encrypt_private_key(self, raw_key: str) -> None:
        if not raw_key:
            raise ValueError("raw_key cannot be empty")
        self.encrypted_private_key = self._get_fernet().encrypt(raw_key.encode("utf-8"))

    def decrypt_private_key(self) -> str:
        if not self.encrypted_private_key:
            raise ValueError("No encrypted private key found for organization")
        decrypted = self._get_fernet().decrypt(bytes(self.encrypted_private_key))
        return decrypted.decode("utf-8")


class Brand(WalletProtectedOrganization):
    """Organization bidding for ad placements."""

    logo = models.ImageField(upload_to=brand_logo_upload_path, null=True, blank=True)

    def __str__(self) -> str:
        return self.name
