from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.bidding.models import AuctionResult, Bid, Refund


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
    creative_ref = serializers.CharField(
        max_length=500,
        error_messages={
            "required": "Creative reference is required.",
            "blank": "Creative reference cannot be empty.",
            "max_length": "Creative reference must be 500 characters or fewer.",
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


class BidSerializer(serializers.ModelSerializer):
    brand = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = Bid
        fields = (
            "id",
            "brand",
            "event_type",
            "amount",
            "creative_ref",
            "tx_hash",
            "is_settled",
            "created_at",
        )


class AuctionResultSerializer(serializers.ModelSerializer):
    winner = serializers.CharField(source="winner.name", read_only=True)

    class Meta:
        model = AuctionResult
        fields = (
            "id",
            "event_type",
            "trigger_number",
            "slot_position",
            "winner",
            "amount",
            "creative_ref",
            "tx_hash",
            "created_at",
        )


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
