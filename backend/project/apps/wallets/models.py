from django.db import models


class Deposit(models.Model):
    """Brand deposit request, minting MBT for custodial wallet."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        FAILED = "failed", "Failed"

    brand = models.ForeignKey(
        "accounts.Brand",
        on_delete=models.CASCADE,
        related_name="deposits",
    )
    amount_pkr = models.DecimalField(max_digits=15, decimal_places=2)
    tx_hash = models.CharField(max_length=66, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Deposit<{self.brand.name}:{self.amount_pkr}>"


class Transaction(models.Model):
    """Generic transaction log for all blockchain actions."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        FAILED = "failed", "Failed"

    brand = models.ForeignKey(
        "accounts.Brand",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    broadcaster = models.ForeignKey(
        "accounts.Broadcaster",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    initiated_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="initiated_transactions",
    )
    action = models.CharField(max_length=50)
    tx_hash = models.CharField(max_length=66, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    gas_used = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Transaction<{self.action}:{self.status}>"
