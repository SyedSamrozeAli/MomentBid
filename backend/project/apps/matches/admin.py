from django.contrib import admin

from apps.matches.models import (
    ExclusionGroup,
    ExclusionGroupMember,
    Match,
    MatchEventConfig,
)


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "on_chain_match_id",
        "team_a",
        "team_b",
        "state",
        "match_date",
    )
    list_filter = ("state",)
    search_fields = ("team_a", "team_b", "broadcaster__name")


@admin.register(MatchEventConfig)
class MatchEventConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "event_type",
        "reserve_price",
        "slot_count",
        "max_triggers",
    )
    list_filter = ("event_type",)


@admin.register(ExclusionGroup)
class ExclusionGroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "broadcaster", "separation_distance", "is_locked")
    list_filter = ("is_locked", "cross_event_separation")


@admin.register(ExclusionGroupMember)
class ExclusionGroupMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "brand")
