from django.db import models


class Bid(models.Model):
    match = models.ForeignKey(
        "matches.Match",
        on_delete=models.CASCADE,
        related_name="bids",
    )
    brand = models.ForeignKey(
        "accounts.Brand",
        on_delete=models.CASCADE,
        related_name="bids",
    )
    event_type = models.IntegerField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    creative_ref = models.CharField(max_length=500)
    tx_hash = models.CharField(max_length=66, blank=True)
    is_settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("match", "brand", "event_type")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Bid<{self.match_id}:{self.brand_id}:{self.event_type}>"


class AuctionResult(models.Model):
    """Indexer-populated auction settlement records."""

    match = models.ForeignKey(
        "matches.Match",
        on_delete=models.CASCADE,
        related_name="auction_results",
    )
    event_type = models.IntegerField()
    trigger_number = models.PositiveSmallIntegerField()
    slot_position = models.PositiveSmallIntegerField()
    winner = models.ForeignKey(
        "accounts.Brand",
        on_delete=models.CASCADE,
        related_name="auction_wins",
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    creative_ref = models.CharField(max_length=500)
    tx_hash = models.CharField(max_length=66)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["event_type", "trigger_number", "slot_position"]

    def __str__(self) -> str:
        return f"AuctionResult<{self.match_id}:{self.event_type}:{self.trigger_number}>"


class Refund(models.Model):
    match = models.ForeignKey(
        "matches.Match",
        on_delete=models.CASCADE,
        related_name="refunds",
    )
    brand = models.ForeignKey(
        "accounts.Brand",
        on_delete=models.CASCADE,
        related_name="refunds",
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    reservation_fee = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tx_hash = models.CharField(max_length=66, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Refund<{self.match_id}:{self.brand_id}:{self.amount}>"
