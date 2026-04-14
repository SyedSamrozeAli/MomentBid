from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.wallets.models import Deposit


class DepositCreateSerializer(serializers.Serializer):
    amount_pkr = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
        error_messages={
            "required": "Deposit amount is required.",
            "invalid": "Deposit amount must be a valid number.",
            "min_value": "Deposit amount must be greater than zero.",
            "max_digits": "Deposit amount is too large.",
        },
    )


class DepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deposit
        fields = ("id", "amount_pkr", "tx_hash", "status", "created_at")
