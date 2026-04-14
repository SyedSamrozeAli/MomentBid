from __future__ import annotations

from rest_framework import serializers

from apps.wallets.models import Deposit


class DepositCreateSerializer(serializers.Serializer):
    amount_pkr = serializers.DecimalField(
        max_digits=15, decimal_places=2, min_value=0.01
    )


class DepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deposit
        fields = ("id", "amount_pkr", "tx_hash", "status", "created_at")
