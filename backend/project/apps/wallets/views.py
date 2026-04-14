from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.permissions import IsBrandUser
from apps.blockchain import get_blockchain_service
from apps.wallets.models import Deposit, Transaction
from apps.wallets.serializers import DepositCreateSerializer, DepositSerializer
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


class DepositListCreateView(APIView):
    permission_classes = [IsBrandUser]

    def get(self, request):
        deposits = Deposit.objects.filter(brand=request.user.brand)
        return CustomResponse.success(data=DepositSerializer(deposits, many=True).data)

    def post(self, request):
        serializer = DepositCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        amount_pkr = serializer.validated_data["amount_pkr"]
        blockchain_service = get_blockchain_service()

        with transaction.atomic():
            tx_result = blockchain_service.mint_tokens(
                request.user.brand.wallet_address,
                int(amount_pkr),
            )

            deposit = Deposit.objects.create(
                brand=request.user.brand,
                amount_pkr=amount_pkr,
                tx_hash=tx_result.tx_hash,
                status=(
                    Deposit.Status.CONFIRMED
                    if tx_result.success
                    else Deposit.Status.FAILED
                ),
            )

            Transaction.objects.create(
                brand=request.user.brand,
                initiated_by=request.user,
                action="mint",
                tx_hash=tx_result.tx_hash,
                status=(
                    Transaction.Status.CONFIRMED
                    if tx_result.success
                    else Transaction.Status.FAILED
                ),
                gas_used=tx_result.gas_used,
                error_message=tx_result.error,
                metadata={"amount_pkr": str(amount_pkr)},
            )

        if not tx_result.success:
            return CustomResponse.error(
                message="Deposit failed",
                error=tx_result.error,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return CustomResponse.success(
            data=DepositSerializer(deposit).data,
            message="Deposit confirmed",
            status_code=status.HTTP_201_CREATED,
        )


class BalanceView(APIView):
    permission_classes = [IsBrandUser]

    def get(self, request):
        from django.db.models import Sum

        from apps.bidding.models import Bid, Refund

        brand = request.user.brand
        total_deposited = (
            Deposit.objects.filter(brand=brand, status="confirmed").aggregate(
                total=Sum("amount_pkr")
            )["total"]
            or 0
        )
        escrowed = (
            Bid.objects.filter(brand=brand, is_settled=False).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        spent = (
            Bid.objects.filter(brand=brand, is_settled=True).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        refunded = (
            Refund.objects.filter(brand=brand).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        balance = int(total_deposited - escrowed - spent + refunded)
        return CustomResponse.success(data={"balance_pkr": balance})
