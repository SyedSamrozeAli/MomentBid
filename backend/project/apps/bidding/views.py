from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsBrandUser
from apps.bidding.models import Bid
from apps.bidding.serializers import (
    BidCreateSerializer,
    BidIncreaseSerializer,
    BidSerializer,
    BudgetCapSerializer,
)
from apps.blockchain import get_blockchain_service
from apps.matches.models import Match
from apps.wallets.models import Transaction
from utils.custom_response import CustomResponse


class MatchBidListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        bids = Bid.objects.select_related("brand").filter(match=match)
        return CustomResponse.success(data=BidSerializer(bids, many=True).data)

    def post(self, request, match_id: int):
        if (
            request.user.role not in {User.Role.BRAND_OWNER, User.Role.BRAND_MEMBER}
            or not request.user.brand
        ):
            return CustomResponse.error(
                message="Only brand users can place bids",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        match = get_object_or_404(Match, pk=match_id)
        if match.state != Match.State.OPEN:
            return CustomResponse.error(message="Bids can only be placed in OPEN state")

        serializer = BidCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        bid_exists = Bid.objects.filter(
            match=match, brand=request.user.brand, event_type=payload["event_type"]
        ).exists()
        if bid_exists:
            return CustomResponse.error(
                message="Bid already exists for this event type",
                status_code=status.HTTP_409_CONFLICT,
            )

        blockchain_service = get_blockchain_service()
        brand_key = request.user.brand.decrypt_private_key()
        spender_address = (
            settings.MOMENTBID_CORE_ADDRESS or request.user.brand.wallet_address
        )

        with transaction.atomic():
            approve_result = blockchain_service.approve_tokens(
                brand_key,
                spender_address,
                int(payload["amount"]),
            )
            if not approve_result.success:
                return CustomResponse.error(
                    message="Token approval failed",
                    error=approve_result.error,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            bid_result = blockchain_service.place_bid(
                brand_key,
                int(match.on_chain_match_id or 0),
                payload["event_type"],
                int(payload["amount"]),
                payload["creative_ref"],
            )
            if not bid_result.success:
                return CustomResponse.error(
                    message="Bid placement failed",
                    error=bid_result.error,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            bid = Bid.objects.create(
                match=match,
                brand=request.user.brand,
                event_type=payload["event_type"],
                amount=payload["amount"],
                creative_ref=payload["creative_ref"],
                tx_hash=bid_result.tx_hash,
            )

            Transaction.objects.create(
                brand=request.user.brand,
                initiated_by=request.user,
                action="place_bid",
                tx_hash=bid_result.tx_hash,
                status=Transaction.Status.CONFIRMED,
                gas_used=bid_result.gas_used,
                metadata={"match_id": match.id, "event_type": payload["event_type"]},
            )

        return CustomResponse.success(
            data=BidSerializer(bid).data,
            status_code=status.HTTP_201_CREATED,
            message="Bid placed",
        )


class MatchBidIncreaseView(APIView):
    permission_classes = [IsBrandUser]

    def patch(self, request, match_id: int, bid_id: int):
        match = get_object_or_404(Match, pk=match_id)
        bid = get_object_or_404(Bid, pk=bid_id, match=match, brand=request.user.brand)

        serializer = BidIncreaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        additional_amount = serializer.validated_data["additional_amount"]

        blockchain_service = get_blockchain_service()
        brand_key = request.user.brand.decrypt_private_key()
        spender_address = (
            settings.MOMENTBID_CORE_ADDRESS or request.user.brand.wallet_address
        )

        with transaction.atomic():
            approve_result = blockchain_service.approve_tokens(
                brand_key,
                spender_address,
                int(additional_amount),
            )
            if not approve_result.success:
                return CustomResponse.error(
                    message="Token approval failed",
                    error=approve_result.error,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            increase_result = blockchain_service.increase_bid(
                brand_key,
                int(match.on_chain_match_id or 0),
                bid.event_type,
                int(additional_amount),
            )
            if not increase_result.success:
                return CustomResponse.error(
                    message="Bid increase failed",
                    error=increase_result.error,
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            bid.amount = bid.amount + additional_amount
            bid.tx_hash = increase_result.tx_hash
            bid.save(update_fields=["amount", "tx_hash"])

            Transaction.objects.create(
                brand=request.user.brand,
                initiated_by=request.user,
                action="increase_bid",
                tx_hash=increase_result.tx_hash,
                status=Transaction.Status.CONFIRMED,
                gas_used=increase_result.gas_used,
                metadata={"match_id": match.id, "event_type": bid.event_type},
            )

        return CustomResponse.success(
            data=BidSerializer(bid).data, message="Bid increased"
        )


class BudgetCapView(APIView):
    permission_classes = [IsBrandUser]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        serializer = BudgetCapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cap = serializer.validated_data["cap"]
        brand_key = request.user.brand.decrypt_private_key()
        blockchain_service = get_blockchain_service()
        tx_result = blockchain_service.set_budget_cap(
            brand_key,
            int(match.on_chain_match_id or 0),
            int(cap),
        )

        if not tx_result.success:
            return CustomResponse.error(
                message="Failed to set budget cap",
                error=tx_result.error,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        Transaction.objects.create(
            brand=request.user.brand,
            initiated_by=request.user,
            action="set_budget_cap",
            tx_hash=tx_result.tx_hash,
            status=Transaction.Status.CONFIRMED,
            gas_used=tx_result.gas_used,
            metadata={"match_id": match.id, "cap": str(cap)},
        )

        return CustomResponse.success(data={"cap": str(cap)}, message="Budget cap set")
