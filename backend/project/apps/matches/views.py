from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminRole, IsBroadcasterUser
from apps.bidding.models import AuctionResult, Bid
from apps.blockchain import get_blockchain_service
from apps.indexer.push import push_match_event
from apps.matches.models import ExclusionGroup, Match, MatchEventConfig
from apps.matches.serializers import (
    ExclusionGroupCreateSerializer,
    ExclusionGroupSerializer,
    MatchCreateSerializer,
    MatchEventConfigCreateSerializer,
    MatchSerializer,
)
from apps.wallets.models import Transaction
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


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
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        blockchain_service = get_blockchain_service()
        broadcaster = request.user.broadcaster

        with transaction.atomic():
            match = serializer.save(broadcaster=broadcaster)

            tx_result = blockchain_service.create_match(
                broadcaster.decrypt_private_key()
            )
            if tx_result.success:
                raw_match_id = tx_result.data.get("match_id")
                if raw_match_id is not None:
                    match.on_chain_match_id = int(raw_match_id)
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
        bids_summary_qs = (
            Bid.objects.filter(match=match)
            .values("event_type")
            .annotate(total_amount=Sum("amount"), bid_count=Count("id"))
        )

        event_type_labels = {
            value: label for value, label in MatchEventConfig.EventType.choices
        }
        bids_summary = [
            {
                **summary,
                "event_type_label": event_type_labels.get(
                    summary["event_type"], str(summary["event_type"])
                ),
            }
            for summary in bids_summary_qs
        ]

        payload = {**MatchSerializer(match).data, "bids_summary": bids_summary}
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
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

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

        # Lock all exclusion groups owned by this broadcaster — once bidding is open
        # the exclusion group composition must not change mid-auction.
        ExclusionGroup.objects.filter(
            broadcaster=request.user.broadcaster, is_locked=False
        ).update(is_locked=True)

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


# ---------------------------------------------------------------------------
# Exclusion Groups
# ---------------------------------------------------------------------------


class ExclusionGroupListCreateView(APIView):
    permission_classes = [IsBroadcasterUser]

    def get(self, request):
        groups = (
            ExclusionGroup.objects.select_related("broadcaster")
            .prefetch_related("members__brand")
            .filter(broadcaster=request.user.broadcaster)
        )
        return CustomResponse.success(
            data=ExclusionGroupSerializer(groups, many=True).data
        )

    def post(self, request):
        serializer = ExclusionGroupCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)
        payload = serializer.validated_data

        brand_ids: list[int] = payload.pop("brand_ids", [])
        group = ExclusionGroup.objects.create(
            broadcaster=request.user.broadcaster, **payload
        )

        if brand_ids:
            from apps.accounts.models import Brand
            from apps.matches.models import ExclusionGroupMember

            members = [
                ExclusionGroupMember(group=group, brand_id=bid) for bid in brand_ids
            ]
            ExclusionGroupMember.objects.bulk_create(members, ignore_conflicts=True)

        blockchain_service = get_blockchain_service()
        brand_addresses = list(
            group.members.select_related("brand").values_list(
                "brand__wallet_address", flat=True
            )
        )
        tx_result = blockchain_service.create_exclusion_group(
            request.user.broadcaster.decrypt_private_key(),
            group.id,
            brand_addresses,
            group.separation_distance,
            group.cross_event_separation,
        )
        if tx_result.success:
            group.on_chain_group_id = group.id
            group.save(update_fields=["on_chain_group_id"])

        return CustomResponse.success(
            data=ExclusionGroupSerializer(group).data,
            status_code=status.HTTP_201_CREATED,
        )


class ExclusionGroupDetailView(APIView):
    permission_classes = [IsBroadcasterUser]

    def get(self, request, group_id: int):
        group = get_object_or_404(
            ExclusionGroup.objects.select_related("broadcaster").prefetch_related(
                "members__brand"
            ),
            pk=group_id,
            broadcaster=request.user.broadcaster,
        )
        return CustomResponse.success(data=ExclusionGroupSerializer(group).data)

    def patch(self, request, group_id: int):
        group = get_object_or_404(
            ExclusionGroup, pk=group_id, broadcaster=request.user.broadcaster
        )
        if group.is_locked:
            return CustomResponse.error(
                message="Group is locked — a match using it is OPEN or ACTIVE",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = ExclusionGroupCreateSerializer(
            group, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)
        serializer.save()
        return CustomResponse.success(data=ExclusionGroupSerializer(group).data)

    def delete(self, request, group_id: int):
        group = get_object_or_404(
            ExclusionGroup, pk=group_id, broadcaster=request.user.broadcaster
        )
        if group.is_locked:
            return CustomResponse.error(
                message="Cannot delete a locked exclusion group",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        group.delete()
        return CustomResponse.success(
            message="Group deleted", status_code=status.HTTP_204_NO_CONTENT
        )


class ExclusionGroupMemberView(APIView):
    permission_classes = [IsBroadcasterUser]

    def post(self, request, group_id: int):
        group = get_object_or_404(
            ExclusionGroup, pk=group_id, broadcaster=request.user.broadcaster
        )
        if group.is_locked:
            return CustomResponse.error(
                message="Group is locked", status_code=status.HTTP_403_FORBIDDEN
            )
        brand_id = request.data.get("brand_id")
        if not brand_id:
            return CustomResponse.error(message="brand_id required")

        from apps.accounts.models import Brand
        from apps.matches.models import ExclusionGroupMember

        brand = get_object_or_404(Brand, pk=brand_id)
        ExclusionGroupMember.objects.get_or_create(group=group, brand=brand)
        return CustomResponse.success(message="Brand added to group")

    def delete(self, request, group_id: int, brand_id: int):
        group = get_object_or_404(
            ExclusionGroup, pk=group_id, broadcaster=request.user.broadcaster
        )
        if group.is_locked:
            return CustomResponse.error(
                message="Group is locked", status_code=status.HTTP_403_FORBIDDEN
            )
        from apps.matches.models import ExclusionGroupMember

        ExclusionGroupMember.objects.filter(group=group, brand_id=brand_id).delete()
        return CustomResponse.success(message="Brand removed from group")


# ---------------------------------------------------------------------------
# Simulator / Oracle API  (admin-only)
# ---------------------------------------------------------------------------


class SimulatorStartView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.state != Match.State.OPEN:
            return CustomResponse.error(message="Match must be OPEN to start")

        blockchain_service = get_blockchain_service()
        broadcaster = match.broadcaster
        tx_result = blockchain_service.transition_state(
            broadcaster.decrypt_private_key(),
            int(match.on_chain_match_id or 0),
            Match.State.ACTIVE,
        )
        if not tx_result.success:
            return CustomResponse.error(
                message="Failed to start match", error=tx_result.error
            )

        match.state = Match.State.ACTIVE
        match.save(update_fields=["state"])

        push_match_event(match.id, "match_state_changed", {"state": Match.State.ACTIVE})
        return CustomResponse.success(
            message="Match started", data={"state": match.state}
        )


class SimulatorCompleteView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.state != Match.State.ACTIVE:
            return CustomResponse.error(message="Match must be ACTIVE to complete")

        blockchain_service = get_blockchain_service()
        broadcaster = match.broadcaster
        tx_result = blockchain_service.transition_state(
            broadcaster.decrypt_private_key(),
            int(match.on_chain_match_id or 0),
            Match.State.COMPLETED,
        )
        if not tx_result.success:
            return CustomResponse.error(
                message="Failed to complete match", error=tx_result.error
            )

        match.state = Match.State.COMPLETED
        match.save(update_fields=["state"])

        push_match_event(
            match.id, "match_state_changed", {"state": Match.State.COMPLETED}
        )
        return CustomResponse.success(
            message="Match completed", data={"state": match.state}
        )


class SimulatorCancelView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, match_id: int):
        match = get_object_or_404(Match, pk=match_id)
        if match.state in {Match.State.COMPLETED, Match.State.CANCELLED}:
            return CustomResponse.error(message="Match is already finished")

        blockchain_service = get_blockchain_service()
        broadcaster = match.broadcaster
        tx_result = blockchain_service.transition_state(
            broadcaster.decrypt_private_key(),
            int(match.on_chain_match_id or 0),
            Match.State.CANCELLED,
        )
        if not tx_result.success:
            return CustomResponse.error(
                message="Failed to cancel match", error=tx_result.error
            )

        match.state = Match.State.CANCELLED
        match.save(update_fields=["state"])

        push_match_event(
            match.id, "match_state_changed", {"state": Match.State.CANCELLED}
        )
        return CustomResponse.success(
            message="Match cancelled", data={"state": match.state}
        )


class SimulatorTriggerEventView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, match_id: int):
        match = get_object_or_404(
            Match.objects.prefetch_related("event_configs"), pk=match_id
        )
        if match.state != Match.State.ACTIVE:
            return CustomResponse.error(
                message="Match must be ACTIVE to trigger events"
            )

        event_type = request.data.get("event_type")
        if event_type is None:
            return CustomResponse.error(message="event_type required")

        try:
            event_type = int(event_type)
        except (TypeError, ValueError):
            return CustomResponse.error(message="event_type must be an integer")

        event_config = match.event_configs.filter(event_type=event_type).first()
        if not event_config:
            return CustomResponse.error(
                message="Event type not configured for this match"
            )

        if event_config.trigger_count >= event_config.max_triggers:
            return CustomResponse.error(
                message="Max trigger count reached for this event type"
            )

        oracle_key = settings.ORACLE_WALLET_PRIVATE_KEY
        if not oracle_key:
            return CustomResponse.error(
                message="ORACLE_WALLET_PRIVATE_KEY not configured"
            )

        blockchain_service = get_blockchain_service()
        tx_result = blockchain_service.trigger_event(
            oracle_key,
            int(match.on_chain_match_id or 0),
            event_type,
        )
        if not tx_result.success:
            return CustomResponse.error(
                message="Event trigger failed", error=tx_result.error
            )

        event_config.trigger_count += 1
        event_config.save(update_fields=["trigger_count"])

        trigger_number = event_config.trigger_count
        winning_bids = list(
            Bid.objects.select_related("brand", "creative")
            .filter(match=match, event_type=event_type)
            .order_by("-amount", "created_at", "id")[: event_config.slot_count]
        )

        if winning_bids:
            AuctionResult.objects.bulk_create(
                [
                    AuctionResult(
                        match=match,
                        event_type=event_type,
                        trigger_number=trigger_number,
                        slot_position=position,
                        winner=bid.brand,
                        amount=bid.amount,
                        creative_ref=(bid.creative.ad_url if bid.creative else ""),
                        tx_hash=tx_result.tx_hash or "",
                    )
                    for position, bid in enumerate(winning_bids, start=1)
                ]
            )

            Bid.objects.filter(
                id__in=[bid.id for bid in winning_bids], is_settled=False
            ).update(is_settled=True)

        slots_filled = len(winning_bids)
        push_match_event(
            match.id,
            "auction_settled",
            {
                "event_type": event_type,
                "trigger_number": trigger_number,
                "slots_filled": slots_filled,
                "tx_hash": tx_result.tx_hash,
            },
        )

        try:
            event_type_label = MatchEventConfig.EventType(event_type).label
        except ValueError:
            event_type_label = str(event_type)

        return CustomResponse.success(
            data={
                "tx_hash": tx_result.tx_hash,
                "event_type": event_type,
                "event_type_label": event_type_label,
                "trigger_number": trigger_number,
                "slots_filled": slots_filled,
            },
            message="Event triggered",
        )


class SimulatorStatusView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, match_id: int):
        match = get_object_or_404(
            Match.objects.prefetch_related("event_configs"), pk=match_id
        )
        event_type_labels = {v: k for k, v in MatchEventConfig.EventType.choices}
        trigger_counts = {
            event_type_labels.get(cfg.event_type, str(cfg.event_type)): {
                "triggered": cfg.trigger_count,
                "max": cfg.max_triggers,
            }
            for cfg in match.event_configs.all()
        }
        return CustomResponse.success(
            data={
                "match_id": match.id,
                "state": match.state,
                "state_label": Match.State(match.state).label,
                "events_enabled": list(trigger_counts.keys()),
                "trigger_counts": trigger_counts,
            }
        )
