from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.bidding.models import AuctionResult, Bid, Creative, Refund
from apps.matches.models import MatchEventConfig


def _event_type_label(event_type: int) -> str:
    try:
        return MatchEventConfig.EventType(event_type).label
    except ValueError:
        return str(event_type)


# ---------------------------------------------------------------------------
# Creative
# ---------------------------------------------------------------------------


class CreativeSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = Creative
        fields = (
            "id",
            "brand",
            "title",
            "description",
            "ad_url",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "brand",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        )


class CreativeCreateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Title is required.",
            "blank": "Title cannot be empty.",
        },
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    ad_url = serializers.URLField(
        max_length=500,
        error_messages={
            "required": "Ad URL is required.",
            "invalid": "Enter a valid URL.",
        },
    )


# ---------------------------------------------------------------------------
# Bid
# ---------------------------------------------------------------------------


class BidCreateSerializer(serializers.Serializer):
    event_type = serializers.IntegerField(
        min_value=0,
        max_value=7,
        error_messages={
            "required": "Event type is required.",
            "invalid": "Event type must be a valid number.",
            "min_value": "Event type must be between 0 and 7.",
            "max_value": "Event type must be between 0 and 7.",
        },
    )
    amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
        error_messages={
            "required": "Bid amount is required.",
            "invalid": "Bid amount must be a valid number.",
            "min_value": "Bid amount must be greater than zero.",
            "max_digits": "Bid amount is too large.",
        },
    )
    creative_id = serializers.IntegerField(
        error_messages={
            "required": "Creative ID is required.",
            "invalid": "Creative ID must be a valid integer.",
        },
    )


class BidIncreaseSerializer(serializers.Serializer):
    additional_amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
        error_messages={
            "required": "Additional amount is required.",
            "invalid": "Additional amount must be a valid number.",
            "min_value": "Additional amount must be greater than zero.",
            "max_digits": "Additional amount is too large.",
        },
    )


class BudgetCapSerializer(serializers.Serializer):
    cap = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
        error_messages={
            "required": "Budget cap is required.",
            "invalid": "Budget cap must be a valid number.",
            "min_value": "Budget cap must be greater than zero.",
            "max_digits": "Budget cap is too large.",
        },
    )


class BidListSerializer(serializers.ModelSerializer):
    """Minimal bid info for leaderboards and lists."""

    brand = serializers.CharField(source="brand.name", read_only=True)
    event_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = ("id", "brand", "amount", "is_settled", "event_type_label", "created_at")

    def get_event_type_label(self, obj: Bid) -> str:
        return _event_type_label(obj.event_type)


class BidDetailedSerializer(serializers.ModelSerializer):
    """Full bid details with creative info and blockchain hash."""

    brand = serializers.CharField(source="brand.name", read_only=True)
    creative = CreativeSerializer(read_only=True)
    event_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = (
            "id",
            "brand",
            "event_type",
            "event_type_label",
            "amount",
            "creative",
            "tx_hash",
            "is_settled",
            "created_at",
        )

    def get_event_type_label(self, obj: Bid) -> str:
        return _event_type_label(obj.event_type)


# Alias for backwards compat
BidSerializer = BidDetailedSerializer


class AuctionResultSerializer(serializers.ModelSerializer):
    winner = serializers.CharField(source="winner.name", read_only=True)
    event_type_label = serializers.SerializerMethodField()

    class Meta:
        model = AuctionResult
        fields = (
            "id",
            "event_type",
            "event_type_label",
            "trigger_number",
            "slot_position",
            "winner",
            "amount",
            "creative_ref",
            "tx_hash",
            "created_at",
        )

    def get_event_type_label(self, obj: AuctionResult) -> str:
        return _event_type_label(obj.event_type)


class RefundSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = Refund
        fields = (
            "id",
            "brand",
            "amount",
            "reservation_fee",
            "tx_hash",
            "created_at",
        )
