from django.contrib import admin
from django.utils.html import format_html

from apps.matches.models import (
    ExclusionGroup,
    ExclusionGroupMember,
    Match,
    MatchEventConfig,
)


# ---------------------------------------------------------------------------
# Design tokens — light-bg badges, consistent radius, no emojis
# ---------------------------------------------------------------------------

def _badge(text: str, fg: str, bg: str) -> str:
    return (
        f'<span style="background:{bg};color:{fg};padding:1px 7px;'
        f'border-radius:3px;font-size:11px;font-weight:500;">{text}</span>'
    )


_GREEN  = ("#166534", "#dcfce7")
_AMBER  = ("#854d0e", "#fef9c3")
_RED    = ("#991b1b", "#fee2e2")
_BLUE   = ("#1d4ed8", "#dbeafe")
_PURPLE = ("#5b21b6", "#ede9fe")
_GREY   = ("#374151", "#f3f4f6")

_STATE_STYLE: dict[int, tuple[str, str]] = {
    0: _GREY,    # CREATED
    1: _GREEN,   # OPEN
    2: _AMBER,   # ACTIVE
    3: _BLUE,    # COMPLETED
    4: _RED,     # CANCELLED
}

_EVENT_NAMES: dict[int, str] = {
    0: "Over Break",
    1: "Strategic Timeout",
    2: "Innings Break",
    3: "Wicket Fall",
    4: "High Value Wicket",
    5: "Last Over Thriller",
    6: "Hat Trick Ball",
    7: "Super Over",
}

# Semantic grouping: routine → blue, milestone → purple, wicket → red, special → amber
_EVENT_STYLE: dict[int, tuple[str, str]] = {
    0: _BLUE,    # Over Break
    1: _BLUE,    # Strategic Timeout
    2: _PURPLE,  # Innings Break
    3: _RED,     # Wicket Fall
    4: _RED,     # High Value Wicket
    5: _AMBER,   # Last Over Thriller
    6: _AMBER,   # Hat Trick Ball
    7: _AMBER,   # Super Over
}


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class MatchEventConfigInline(admin.TabularInline):
    model = MatchEventConfig
    fields = (
        "event_type",
        "reserve_price",
        "reservation_fee_pct",
        "slot_count",
        "max_triggers",
        "trigger_count",
    )
    readonly_fields = ("trigger_count",)
    extra = 1
    verbose_name = "Event Config"
    verbose_name_plural = "Event Configs"


class ExclusionGroupMemberInline(admin.TabularInline):
    model = ExclusionGroupMember
    fields = ("brand",)
    autocomplete_fields = ("brand",)
    extra = 1
    verbose_name = "Member Brand"
    verbose_name_plural = "Member Brands"


# ---------------------------------------------------------------------------
# Match
# ---------------------------------------------------------------------------

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match_display",
        "broadcaster",
        "state_badge",
        "on_chain_match_id",
        "event_count",
        "bid_count",
        "match_date",
        "created_at",
    )
    list_display_links = ("id", "match_display")
    list_filter = ("state", "broadcaster")
    search_fields = ("team_a", "team_b", "broadcaster__name")
    list_select_related = ("broadcaster",)
    list_per_page = 25
    date_hierarchy = "match_date"
    ordering = ("-match_date",)
    inlines = [MatchEventConfigInline]
    readonly_fields = ("on_chain_match_id", "create_tx_hash", "created_at", "state")

    fieldsets = (
        ("Match Details", {
            "fields": ("broadcaster", "team_a", "team_b", "venue", "match_date"),
        }),
        ("Blockchain State", {
            "fields": ("state", "on_chain_match_id", "create_tx_hash"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    def match_display(self, obj: Match) -> str:
        return format_html(
            '<strong style="font-size:13px;">{}</strong>'
            '<span style="color:#9ca3af;margin:0 6px;font-size:11px;">vs</span>'
            '<strong style="font-size:13px;">{}</strong>',
            obj.team_a,
            obj.team_b,
        )
    match_display.short_description = "Match"

    def state_badge(self, obj: Match) -> str:
        fg, bg = _STATE_STYLE.get(obj.state, _GREY)
        label = Match.State(obj.state).label
        return format_html(_badge(label, fg, bg))
    state_badge.short_description = "State"

    def event_count(self, obj: Match) -> int:
        return obj.event_configs.count()
    event_count.short_description = "Events"

    def bid_count(self, obj: Match) -> int:
        return obj.bids.count()
    bid_count.short_description = "Bids"


# ---------------------------------------------------------------------------
# MatchEventConfig
# ---------------------------------------------------------------------------

@admin.register(MatchEventConfig)
class MatchEventConfigAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "event_chip",
        "reserve_price",
        "reservation_fee_pct",
        "slot_count",
        "trigger_bar",
    )
    list_display_links = ("id",)
    list_filter = ("event_type", "match__state")
    search_fields = ("match__team_a", "match__team_b")
    list_select_related = ("match",)
    list_per_page = 25
    ordering = ("match", "event_type")
    readonly_fields = ("trigger_count",)

    def event_chip(self, obj: MatchEventConfig) -> str:
        name = _EVENT_NAMES.get(obj.event_type, str(obj.event_type))
        fg, bg = _EVENT_STYLE.get(obj.event_type, _GREY)
        return format_html(_badge(name, fg, bg))
    event_chip.short_description = "Event Type"

    def trigger_bar(self, obj: MatchEventConfig) -> str:
        if not obj.max_triggers:
            return "—"
        pct = int((obj.trigger_count / obj.max_triggers) * 100)
        bar_color = (
            "#16a34a" if pct < 70 else "#d97706" if pct < 100 else "#dc2626"
        )
        return format_html(
            '<div style="display:flex;align-items:center;gap:8px;">'
            '<div style="width:90px;background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;">'
            '<div style="width:{pct}%;background:{color};height:6px;border-radius:4px;"></div>'
            '</div>'
            '<span style="font-size:11px;color:#6b7280;">{done}/{total}</span>'
            '</div>',
            pct=pct,
            color=bar_color,
            done=obj.trigger_count,
            total=obj.max_triggers,
        )
    trigger_bar.short_description = "Triggers"


# ---------------------------------------------------------------------------
# ExclusionGroup
# ---------------------------------------------------------------------------

@admin.register(ExclusionGroup)
class ExclusionGroupAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "broadcaster",
        "separation_distance",
        "scope_badge",
        "lock_badge",
        "member_count",
        "created_at",
    )
    list_display_links = ("id", "name")
    list_filter = ("is_locked", "cross_event_separation", "broadcaster")
    search_fields = ("name", "broadcaster__name")
    list_select_related = ("broadcaster",)
    list_per_page = 25
    ordering = ("-created_at",)
    inlines = [ExclusionGroupMemberInline]

    fieldsets = (
        ("Group", {
            "fields": ("name", "broadcaster", "separation_distance", "cross_event_separation"),
        }),
        ("Status", {
            "fields": ("is_locked", "on_chain_group_id"),
        }),
    )

    def scope_badge(self, obj: ExclusionGroup) -> str:
        if obj.cross_event_separation:
            return format_html(_badge("Cross-Event", *_PURPLE))
        return format_html(_badge("Same Event", *_GREY))
    scope_badge.short_description = "Scope"

    def lock_badge(self, obj: ExclusionGroup) -> str:
        if obj.is_locked:
            return format_html(_badge("Locked", *_RED))
        return format_html(_badge("Unlocked", *_GREEN))
    lock_badge.short_description = "Lock"

    def member_count(self, obj: ExclusionGroup) -> int:
        return obj.members.count()
    member_count.short_description = "Brands"


# ---------------------------------------------------------------------------
# ExclusionGroupMember
# ---------------------------------------------------------------------------

@admin.register(ExclusionGroupMember)
class ExclusionGroupMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "brand")
    list_display_links = ("id",)
    list_select_related = ("group", "brand")
    search_fields = ("group__name", "brand__name")
    list_per_page = 25
