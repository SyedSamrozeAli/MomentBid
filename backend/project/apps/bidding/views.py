from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsBrandUser
from apps.bidding.models import AuctionResult, Bid, Creative, Refund
from apps.bidding.serializers import (
    AuctionResultSerializer,
    BidCreateSerializer,
    BidDetailedSerializer,
    BidIncreaseSerializer,
    BidListSerializer,
    BudgetCapSerializer,
    CreativeCreateSerializer,
    CreativeSerializer,
    RefundSerializer,
)
from apps.blockchain import get_blockchain_service
from apps.matches.models import Match, MatchEventConfig
from apps.wallets.models import Transaction
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


class MatchBidListView(APIView):
    """
    GET /matches/{id}/bids/all/
    Query params:
      ?event_type=0..7  — filter to one event type
      ?ordering=amount|-amount  — sort (default: -amount, highest first)
    Returns flat list; use /bids/leaderboard/ for grouped view.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, match_id: int):
        get_object_or_404(Match, pk=match_id)
        qs = Bid.objects.select_related("brand").filter(match_id=match_id)

        event_type = request.query_params.get("event_type")
        if event_type is not None:
            try:
                qs = qs.filter(event_type=int(event_type))
            except ValueError:
                pass

        ordering = request.query_params.get("ordering", "-amount")
        if ordering in ("amount", "-amount", "created_at", "-created_at"):
            qs = qs.order_by(ordering)

        return CustomResponse.success(data=BidListSerializer(qs, many=True).data)


class MatchBidLeaderboardView(APIView):
    """
    GET /matches/{id}/bids/leaderboard/
    Returns bids grouped by event type, each group sorted highest → lowest.
    Query params:
      ?event_type=0..7  — return only that event type's group
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, match_id: int):
        get_object_or_404(Match, pk=match_id)
        qs = Bid.objects.select_related("brand").filter(
            match_id=match_id
        ).order_by("event_type", "-amount")

        event_type = request.query_params.get("event_type")
        if event_type is not None:
            try:
                qs = qs.filter(event_type=int(event_type))
            except ValueError:
                pass

        event_labels = {v: l for v, l in MatchEventConfig.EventType.choices}
        grouped: dict[int, dict] = {}
        for bid in qs:
            et = bid.event_type
            if et not in grouped:
                grouped[et] = {
                    "event_type": et,
                    "event_type_label": event_labels.get(et, str(et)),
                    "bids": [],
                    "total_escrowed": 0,
                }
            entry = grouped[et]
            entry["bids"].append(BidListSerializer(bid).data)
            entry["total_escrowed"] += int(bid.amount)

        return CustomResponse.success(data=list(grouped.values()))


class MatchBidListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        bids = Bid.objects.select_related("brand", "creative").filter(match=match)
        return CustomResponse.success(data=BidDetailedSerializer(bids, many=True).data)

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

        # Resolve and validate creative
        creative = Creative.objects.filter(
            pk=payload["creative_id"], brand=request.user.brand
        ).first()
        if not creative:
            return CustomResponse.error(
                message="Creative not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if creative.status != Creative.Status.APPROVED:
            return CustomResponse.error(
                message="Creative must be approved before use in bids",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Validate event config exists for this match + event_type
        event_config = MatchEventConfig.objects.filter(
            match=match, event_type=payload["event_type"]
        ).first()
        if not event_config:
            return CustomResponse.error(
                message="No event configuration found for this event type on the selected match",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Validate bid amount >= reserve price
        if payload["amount"] < event_config.reserve_price:
            return CustomResponse.error(
                message=f"Bid amount must be at least PKR {event_config.reserve_price:,} (reserve price)",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        bid_exists = Bid.objects.filter(
            match=match, brand=request.user.brand, event_type=payload["event_type"]
        ).exists()
        if bid_exists:
            return CustomResponse.error(
                message="Bid already exists for this event type",
                status_code=status.HTTP_409_CONFLICT,
            )

        # DB-level balance check — mock service in-memory state resets on server restart
        from django.db.models import Sum as _Sum

        from apps.wallets.models import Deposit as _Deposit
        from apps.bidding.models import Refund as _Refund

        _brand = request.user.brand
        _deposited = _Deposit.objects.filter(brand=_brand, status="confirmed").aggregate(t=_Sum("amount_pkr"))["t"] or 0
        _escrowed  = Bid.objects.filter(brand=_brand, is_settled=False).aggregate(t=_Sum("amount"))["t"] or 0
        _spent     = Bid.objects.filter(brand=_brand, is_settled=True).aggregate(t=_Sum("amount"))["t"] or 0
        _refunded  = _Refund.objects.filter(brand=_brand).aggregate(t=_Sum("amount"))["t"] or 0
        _available = int(_deposited - _escrowed - _spent + _refunded)

        if _available < int(payload["amount"]):
            return CustomResponse.error(
                message=f"Insufficient balance. Available: PKR {_available:,}",
                status_code=status.HTTP_400_BAD_REQUEST,
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
                creative.ad_url,
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
                creative=creative,
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

        # Refresh to include creative relation for detailed serializer
        bid = Bid.objects.select_related("creative").get(pk=bid.pk)
        return CustomResponse.success(
            data=BidDetailedSerializer(bid).data,
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

        # Refresh to include creative relation
        bid = Bid.objects.select_related("creative").get(pk=bid.pk)
        return CustomResponse.success(
            data=BidDetailedSerializer(bid).data, message="Bid increased"
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
        event_type_labels = {
            value: label for value, label in MatchEventConfig.EventType.choices
        }
        grouped: list[dict] = []
        for (event_type, trigger_number), slots in groupby(
            results, key=lambda r: (r.event_type, r.trigger_number)
        ):
            slot_list = list(slots)
            grouped.append(
                {
                    "event_type": event_type,
                    "event_type_label": event_type_labels.get(
                        event_type, str(event_type)
                    ),
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


# ---------------------------------------------------------------------------
# Creative
# ---------------------------------------------------------------------------


class CreativeListCreateView(APIView):
    """
    GET  /creatives/          — brand sees own creatives; filters: ?status=, ?search=, ?ordering=
    POST /creatives/          — brand uploads new creative (starts as pending)
    """

    permission_classes = [IsBrandUser]

    def get(self, request):
        qs = Creative.objects.select_related("brand").filter(brand=request.user.brand)

        # Filter by status: ?status=approved|pending|rejected
        status = request.query_params.get("status")
        if status and status in {s[0] for s in Creative.Status.choices}:
            qs = qs.filter(status=status)

        # Search by title: ?search=keyword
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(title__icontains=search)

        # Ordering: ?ordering=created_at|-created_at|title|-title
        ordering = request.query_params.get("ordering", "-created_at")
        if ordering in (
            "created_at",
            "-created_at",
            "title",
            "-title",
            "status",
            "-status",
        ):
            qs = qs.order_by(ordering)

        return CustomResponse.success(data=CreativeSerializer(qs, many=True).data)

    def post(self, request):
        serializer = CreativeCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)
        data = serializer.validated_data

        creative = Creative.objects.create(
            brand=request.user.brand,
            title=data["title"],
            description=data.get("description", ""),
            ad_url=data["ad_url"],
        )
        return CustomResponse.success(
            data=CreativeSerializer(creative).data,
            message="Creative submitted for review",
            status_code=status.HTTP_201_CREATED,
        )


class CreativeDetailView(APIView):
    """GET /creatives/{id}/ — brand retrieves own creative."""

    permission_classes = [IsBrandUser]

    def get(self, request, creative_id: int):
        creative = get_object_or_404(Creative, pk=creative_id, brand=request.user.brand)
        return CustomResponse.success(data=CreativeSerializer(creative).data)
