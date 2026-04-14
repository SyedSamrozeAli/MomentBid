from __future__ import annotations

from rest_framework import serializers

from apps.matches.models import Match, MatchEventConfig


class MatchCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = ("team_a", "team_b", "venue", "match_date")


class MatchEventConfigCreateSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = MatchEventConfig
        fields = (
            "id",
            "event_type",
            "reserve_price",
            "reservation_fee_pct",
            "slot_count",
            "max_triggers",
            "trigger_count",
        )


class MatchSerializer(serializers.ModelSerializer):
    broadcaster = serializers.CharField(source="broadcaster.name", read_only=True)
    event_configs = MatchEventConfigSerializer(many=True, read_only=True)

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
            "state",
            "create_tx_hash",
            "created_at",
            "event_configs",
        )
