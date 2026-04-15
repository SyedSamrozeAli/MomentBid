from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.bidding.models import AuctionResult, Bid, Creative, Refund
from apps.matches.models import Match, MatchEventConfig


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


class CreativeDisapproveSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        error_messages={
            "max_length": "Rejection reason cannot exceed 1000 characters.",
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
        fields = (
            "id",
            "brand",
            "amount",
            "is_settled",
            "is_cancelled",
            "event_type_label",
            "created_at",
        )

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
            "is_cancelled",
            "created_at",
        )

    def get_event_type_label(self, obj: Bid) -> str:
        return _event_type_label(obj.event_type)


class BrandBidHistorySerializer(serializers.ModelSerializer):
    """Bid history entries for the logged-in brand with match metadata."""

    event_type_label = serializers.SerializerMethodField()
    match_id = serializers.IntegerField(source="match.id", read_only=True)
    match_title = serializers.SerializerMethodField()
    match_date = serializers.DateField(source="match.match_date", read_only=True)
    match_time = serializers.TimeField(source="match.match_time", read_only=True)
    match_state = serializers.IntegerField(source="match.state", read_only=True)
    match_state_label = serializers.CharField(source="match.get_state_display")
    creative_title = serializers.SerializerMethodField()
    creative_ad_url = serializers.SerializerMethodField()
    bid_status = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = (
            "id",
            "match_id",
            "match_title",
            "match_date",
            "match_time",
            "match_state",
            "match_state_label",
            "event_type",
            "event_type_label",
            "amount",
            "creative_title",
            "creative_ad_url",
            "tx_hash",
            "cancel_tx_hash",
            "is_settled",
            "is_cancelled",
            "bid_status",
            "created_at",
        )

    def get_event_type_label(self, obj: Bid) -> str:
        return _event_type_label(obj.event_type)

    def get_match_title(self, obj: Bid) -> str:
        return f"{obj.match.team_a} vs {obj.match.team_b}"

    def get_creative_title(self, obj: Bid) -> str:
        if obj.creative:
            return obj.creative.title
        return ""

    def get_creative_ad_url(self, obj: Bid) -> str:
        if obj.creative:
            return obj.creative.ad_url
        return ""

    def get_bid_status(self, obj: Bid) -> str:
        if obj.is_cancelled:
            return "cancelled"
        if obj.is_settled:
            return "settled"
        if obj.match.state in (Match.State.OPEN, Match.State.ACTIVE):
            return "active"
        return "history"


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
