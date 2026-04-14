from __future__ import annotations

from rest_framework import serializers

from apps.matches.models import (
    ExclusionGroup,
    ExclusionGroupMember,
    Match,
    MatchEventConfig,
)


class MatchCreateSerializer(serializers.ModelSerializer):
    team_a = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "Team A name is required.",
            "blank": "Team A name cannot be empty.",
            "max_length": "Team A name must be 100 characters or fewer.",
        },
    )
    team_b = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "Team B name is required.",
            "blank": "Team B name cannot be empty.",
            "max_length": "Team B name must be 100 characters or fewer.",
        },
    )
    venue = serializers.CharField(
        max_length=200,
        error_messages={
            "required": "Venue is required.",
            "blank": "Venue cannot be empty.",
            "max_length": "Venue must be 200 characters or fewer.",
        },
    )
    match_date = serializers.DateField(
        error_messages={
            "required": "Match date is required.",
            "invalid": "Match date must be a valid date.",
        },
    )
    match_time = serializers.TimeField(
        error_messages={
            "required": "Match time is required.",
            "invalid": "Match time must be a valid time.",
        },
    )

    class Meta:
        model = Match
        fields = ("team_a", "team_b", "venue", "match_date", "match_time")


class MatchEventConfigCreateSerializer(serializers.ModelSerializer):
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
    reserve_price = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0,
        error_messages={
            "required": "Reserve price is required.",
            "invalid": "Reserve price must be a valid number.",
            "min_value": "Reserve price cannot be negative.",
            "max_digits": "Reserve price is too large.",
        },
    )
    reservation_fee_pct = serializers.DecimalField(
        max_digits=4,
        decimal_places=2,
        min_value=0,
        max_value=100,
        error_messages={
            "required": "Reservation fee percentage is required.",
            "invalid": "Reservation fee percentage must be a valid number.",
            "min_value": "Reservation fee percentage cannot be negative.",
            "max_value": "Reservation fee percentage cannot exceed 100.",
        },
    )
    slot_count = serializers.IntegerField(
        min_value=1,
        error_messages={
            "required": "Slot count is required.",
            "invalid": "Slot count must be a valid whole number.",
            "min_value": "Slot count must be at least 1.",
        },
    )
    max_triggers = serializers.IntegerField(
        min_value=1,
        error_messages={
            "required": "Maximum triggers is required.",
            "invalid": "Maximum triggers must be a valid whole number.",
            "min_value": "Maximum triggers must be at least 1.",
        },
    )

    class Meta:
        model = MatchEventConfig
        fields = (
            "event_type",
            "reserve_price",
            "reservation_fee_pct",
            "slot_count",
            "max_triggers",
        )


class MatchEventConfigSerializer(serializers.ModelSerializer):
    event_type_label = serializers.SerializerMethodField()

    class Meta:
        model = MatchEventConfig
        fields = (
            "id",
            "event_type",
            "event_type_label",
            "reserve_price",
            "reservation_fee_pct",
            "slot_count",
            "max_triggers",
            "trigger_count",
        )

    def get_event_type_label(self, obj: MatchEventConfig) -> str:
        try:
            return MatchEventConfig.EventType(obj.event_type).label
        except ValueError:
            return str(obj.event_type)


class MatchSerializer(serializers.ModelSerializer):
    broadcaster = serializers.CharField(source="broadcaster.name", read_only=True)
    event_configs = MatchEventConfigSerializer(many=True, read_only=True)
    state_label = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = (
            "id",
            "on_chain_match_id",
            "broadcaster",
            "team_a",
            "team_b",
            "venue",
            "match_date",
            "match_time",
            "state",
            "state_label",
            "create_tx_hash",
            "created_at",
            "event_configs",
        )

    def get_state_label(self, obj: Match) -> str:
        return Match.State(obj.state).label


class ExclusionGroupMemberSerializer(serializers.ModelSerializer):
    brand_id = serializers.IntegerField(source="brand.id", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    wallet_address = serializers.CharField(
        source="brand.wallet_address", read_only=True
    )

    class Meta:
        model = ExclusionGroupMember
        fields = ("brand_id", "brand_name", "wallet_address")


class ExclusionGroupSerializer(serializers.ModelSerializer):
    members = ExclusionGroupMemberSerializer(many=True, read_only=True)
    broadcaster = serializers.CharField(source="broadcaster.name", read_only=True)

    class Meta:
        model = ExclusionGroup
        fields = (
            "id",
            "name",
            "broadcaster",
            "separation_distance",
            "cross_event_separation",
            "is_locked",
            "on_chain_group_id",
            "members",
            "created_at",
        )


class ExclusionGroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=100,
        error_messages={
            "required": "Group name is required.",
            "blank": "Group name cannot be empty.",
            "max_length": "Group name must be 100 characters or fewer.",
        },
    )
    separation_distance = serializers.IntegerField(
        min_value=1,
        default=1,
        error_messages={
            "invalid": "Separation distance must be a valid whole number.",
            "min_value": "Separation distance must be at least 1.",
        },
    )
    cross_event_separation = serializers.BooleanField(default=False)
    brand_ids = serializers.ListField(
        child=serializers.IntegerField(
            error_messages={"invalid": "Each brand id must be a valid whole number."}
        ),
        required=False,
        default=list,
        error_messages={
            "invalid": "brand_ids must be provided as a list of brand ids."
        },
    )
