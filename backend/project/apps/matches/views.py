from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsBroadcasterUser
from apps.bidding.models import Bid
from apps.blockchain import get_blockchain_service
from apps.matches.models import Match, MatchEventConfig
from apps.matches.serializers import (
    MatchCreateSerializer,
    MatchEventConfigCreateSerializer,
    MatchSerializer,
)
from apps.wallets.models import Transaction
from utils.custom_response import CustomResponse


class MatchListCreateView(APIView):
    def get(self, request):
        queryset = Match.objects.select_related("broadcaster").prefetch_related(
            "event_configs"
        )

        state_filter = request.query_params.get("state")
        if state_filter is not None:
            queryset = queryset.filter(state=state_filter)

        return CustomResponse.success(data=MatchSerializer(queryset, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return CustomResponse.error(
                message="Authentication required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        if (
            request.user.role != User.Role.BROADCASTER_OWNER
            or not request.user.broadcaster
        ):
            return CustomResponse.error(
                message="Only broadcaster owners can create matches",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = MatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        blockchain_service = get_blockchain_service()
        broadcaster = request.user.broadcaster

        with transaction.atomic():
            match = serializer.save(broadcaster=broadcaster)

            tx_result = blockchain_service.create_match(
                broadcaster.decrypt_private_key()
            )
            if tx_result.success:
                match.on_chain_match_id = int(tx_result.data.get("match_id", 0) or 0)
                match.create_tx_hash = tx_result.tx_hash
                match.save(update_fields=["on_chain_match_id", "create_tx_hash"])

            Transaction.objects.create(
                broadcaster=broadcaster,
                initiated_by=request.user,
                action="create_match",
                tx_hash=tx_result.tx_hash,
                status=(
                    Transaction.Status.CONFIRMED
                    if tx_result.success
                    else Transaction.Status.FAILED
                ),
                gas_used=tx_result.gas_used,
                error_message=tx_result.error,
                metadata={"match_id": match.id},
            )

        if not tx_result.success:
            return CustomResponse.error(
                message="Match created locally but blockchain transaction failed",
                error=tx_result.error,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return CustomResponse.success(
            data=MatchSerializer(match).data,
            message="Match created",
            status_code=status.HTTP_201_CREATED,
        )


class MatchDetailView(APIView):
    def get(self, request, match_id: int):
        match = get_object_or_404(
            Match.objects.select_related("broadcaster").prefetch_related(
                "event_configs"
            ),
            pk=match_id,
        )
        bids_summary = (
            Bid.objects.filter(match=match)
            .values("event_type")
            .annotate(total_amount=Sum("amount"), bid_count=Count("id"))
        )

        payload = MatchSerializer(match).data
        payload["bids_summary"] = list(bids_summary)
        return CustomResponse.success(data=payload)


class MatchEventConfigCreateView(APIView):
    permission_classes = [IsBroadcasterUser]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.broadcaster_id != request.user.broadcaster_id:
            return CustomResponse.error(
                message="You do not own this match",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if match.state != Match.State.CREATED:
            return CustomResponse.error(
                message="Event configs can only be added in CREATED state"
            )

        serializer = MatchEventConfigCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        blockchain_service = get_blockchain_service()
        with transaction.atomic():
            event_config = serializer.save(match=match)
            tx_result = blockchain_service.configure_event(
                request.user.broadcaster.decrypt_private_key(),
                int(match.on_chain_match_id or 0),
                event_config.event_type,
                int(event_config.reserve_price),
                int(event_config.reservation_fee_pct),
                event_config.slot_count,
                event_config.max_triggers,
            )

            Transaction.objects.create(
                broadcaster=request.user.broadcaster,
                initiated_by=request.user,
                action="configure_event",
                tx_hash=tx_result.tx_hash,
                status=(
                    Transaction.Status.CONFIRMED
                    if tx_result.success
                    else Transaction.Status.FAILED
                ),
                gas_used=tx_result.gas_used,
                error_message=tx_result.error,
                metadata={"match_id": match.id, "event_type": event_config.event_type},
            )

        if not tx_result.success:
            return CustomResponse.error(
                message="Event configuration saved locally but blockchain call failed",
                error=tx_result.error,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return CustomResponse.success(
            data={"id": event_config.id}, status_code=status.HTTP_201_CREATED
        )


class MatchOpenBiddingView(APIView):
    permission_classes = [IsBroadcasterUser]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.broadcaster_id != request.user.broadcaster_id:
            return CustomResponse.error(
                message="You do not own this match",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        if match.state != Match.State.CREATED:
            return CustomResponse.error(message="Only CREATED matches can be opened")

        blockchain_service = get_blockchain_service()
        tx_result = blockchain_service.transition_state(
            request.user.broadcaster.decrypt_private_key(),
            int(match.on_chain_match_id or 0),
            Match.State.OPEN,
        )

        if not tx_result.success:
            return CustomResponse.error(
                message="Failed to open bidding",
                error=tx_result.error,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        match.state = Match.State.OPEN
        match.save(update_fields=["state"])

        Transaction.objects.create(
            broadcaster=request.user.broadcaster,
            initiated_by=request.user,
            action="open_bidding",
            tx_hash=tx_result.tx_hash,
            status=Transaction.Status.CONFIRMED,
            gas_used=tx_result.gas_used,
            metadata={"match_id": match.id},
        )

        return CustomResponse.success(message="Bidding opened")
