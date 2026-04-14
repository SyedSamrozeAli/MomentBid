from __future__ import annotations

from rest_framework import serializers

from apps.bidding.models import Bid


class BidCreateSerializer(serializers.Serializer):
    event_type = serializers.IntegerField(min_value=0)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=0.01)
    creative_ref = serializers.CharField(max_length=500)


class BidIncreaseSerializer(serializers.Serializer):
    additional_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, min_value=0.01
    )


class BudgetCapSerializer(serializers.Serializer):
    cap = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=0.01)


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
