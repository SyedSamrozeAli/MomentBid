from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsBrandUser
from apps.bidding.models import AuctionResult, Bid, Refund
from apps.bidding.serializers import (
    AuctionResultSerializer,
    BidCreateSerializer,
    BidIncreaseSerializer,
    BidSerializer,
    BudgetCapSerializer,
    RefundSerializer,
)
from apps.blockchain import get_blockchain_service
from apps.matches.models import Match
from apps.wallets.models import Transaction
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


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
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)
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
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)
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
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

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


class AuctionResultListView(APIView):
    """All auction settlements for a match, grouped by (event_type, trigger_number)."""

    def get(self, request, match_id: int):
        from itertools import groupby

        results = AuctionResult.objects.select_related("winner").filter(
            match_id=match_id
        )
        grouped: list[dict] = []
        for (event_type, trigger_number), slots in groupby(
            results, key=lambda r: (r.event_type, r.trigger_number)
        ):
            slot_list = list(slots)
            grouped.append(
                {
                    "event_type": event_type,
                    "trigger_number": trigger_number,
                    "slots": AuctionResultSerializer(slot_list, many=True).data,
                    "slots_filled": len(slot_list),
                }
            )
        return CustomResponse.success(data=grouped)


class RefundClaimView(APIView):
    permission_classes = [IsBrandUser]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.state not in {Match.State.COMPLETED, Match.State.CANCELLED}:
            return CustomResponse.error(
                message="Refunds only available after match is COMPLETED or CANCELLED"
            )

        already_claimed = Refund.objects.filter(
            match=match, brand=request.user.brand
        ).exists()
        if already_claimed:
            return CustomResponse.error(
                message="Refund already claimed for this match",
                status_code=status.HTTP_409_CONFLICT,
            )

        blockchain_service = get_blockchain_service()
        brand_key = request.user.brand.decrypt_private_key()
        tx_result = blockchain_service.claim_refund(
            brand_key, int(match.on_chain_match_id or 0)
        )
        if not tx_result.success:
            return CustomResponse.error(
                message="Refund claim failed", error=tx_result.error
            )

        refund_amount = tx_result.data.get("refund_amount", 0)
        refund = Refund.objects.create(
            match=match,
            brand=request.user.brand,
            amount=refund_amount,
            tx_hash=tx_result.tx_hash,
        )

        from apps.indexer.push import push_match_event

        push_match_event(
            match.id,
            "refund_processed",
            {"brand": request.user.brand.name, "amount": refund_amount},
        )

        return CustomResponse.success(
            data=RefundSerializer(refund).data,
            message="Refund claimed",
            status_code=status.HTTP_201_CREATED,
        )


class RefundListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id: int):
        get_object_or_404(Match, pk=match_id)
        qs = Refund.objects.select_related("brand").filter(match_id=match_id)
        if request.user.brand:
            qs = qs.filter(brand=request.user.brand)
        return CustomResponse.success(data=RefundSerializer(qs, many=True).data)
