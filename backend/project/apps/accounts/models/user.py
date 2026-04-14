from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from apps.accounts.models.brands import Brand
from apps.accounts.models.broadcaster import Broadcaster


class User(AbstractUser):
    """Person account belonging to exactly one organization type."""

    class Role(models.TextChoices):
        BRAND_OWNER = "brand_owner", "Brand Owner"
        BRAND_MEMBER = "brand_member", "Brand Member"
        BROADCASTER_OWNER = "broadcaster_owner", "Broadcaster Owner"
        BROADCASTER_MEMBER = "broadcaster_member", "Broadcaster Member"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=25, choices=Role.choices)
    brand = models.ForeignKey(
        Brand,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="users",
    )
    broadcaster = models.ForeignKey(
        Broadcaster,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="users",
    )

    def clean(self) -> None:
        super().clean()
        if self.brand and self.broadcaster:
            raise ValidationError("User can only belong to one organization type")
        if (
            self.role in {self.Role.BRAND_OWNER, self.Role.BRAND_MEMBER}
            and not self.brand
        ):
            raise ValidationError("Brand users must be linked to a brand")
        if (
            self.role in {self.Role.BROADCASTER_OWNER, self.Role.BROADCASTER_MEMBER}
            and not self.broadcaster
        ):
            raise ValidationError("Broadcaster users must be linked to a broadcaster")

    def is_brand_user(self) -> bool:
        return self.brand is not None

    def is_broadcaster_user(self) -> bool:
        return self.broadcaster is not None

    def get_org(self) -> Brand | Broadcaster | None:
        return self.brand or self.broadcaster
