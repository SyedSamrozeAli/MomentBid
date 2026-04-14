from django.contrib import admin
from django.utils.html import format_html

from apps.bidding.models import AuctionResult, Bid, Creative, Refund


# ---------------------------------------------------------------------------
# Design tokens — light-bg badges, consistent radius, no emojis
# ---------------------------------------------------------------------------

def _badge(text: str, fg: str, bg: str) -> str:
    return format_html(
        '<span style="background:{};color:{};padding:1px 7px;'
        'border-radius:3px;font-size:11px;font-weight:500;">{}</span>',
        bg,
        fg,
        text,
    )


def _pkr(amount) -> str:
    return f"PKR {int(amount):,}"


_GREEN  = ("#166534", "#dcfce7")
_AMBER  = ("#854d0e", "#fef9c3")
_RED    = ("#991b1b", "#fee2e2")
_BLUE   = ("#1d4ed8", "#dbeafe")
_PURPLE = ("#5b21b6", "#ede9fe")
_GREY   = ("#374151", "#f3f4f6")

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
    0: _BLUE,
    1: _BLUE,
    2: _PURPLE,
    3: _RED,
    4: _RED,
    5: _AMBER,
    6: _AMBER,
    7: _AMBER,
}

_SLOT_STYLE: dict[int, tuple[str, str]] = {
    1: _BLUE,
    2: _GREY,
    3: _GREY,
}


def _tx_chip(tx_hash: str) -> str:
    if not tx_hash:
        return "—"
    short = f"{tx_hash[:8]}…{tx_hash[-6:]}"
    return format_html(
        '<code style="background:#f8fafc;color:#475569;padding:2px 6px;'
        'border-radius:3px;font-size:11px;border:1px solid #e2e8f0;">{}</code>',
        short,
    )


# ---------------------------------------------------------------------------
# Creative
# ---------------------------------------------------------------------------

@admin.register(Creative)
class CreativeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "brand",
        "status_badge",
        "ad_link",
        "created_at",
    )
    list_display_links = ("id", "title")
    list_filter = ("status", "brand")
    search_fields = ("title", "brand__name", "ad_url")
    list_select_related = ("brand",)
    list_per_page = 25
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at")
    actions = ("approve_creatives", "reject_creatives")

    fieldsets = (
        ("Creative", {
            "fields": ("brand", "title", "description", "ad_url"),
        }),
        ("Review", {
            "fields": ("status", "rejection_reason"),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )

    def approve_creatives(self, request, queryset):
        queryset.update(status=Creative.Status.APPROVED, rejection_reason="")
        self.message_user(request, f"{queryset.count()} creatives approved.")
    approve_creatives.short_description = "Approve selected creatives"

    def reject_creatives(self, request, queryset):
        queryset.update(status=Creative.Status.REJECTED)
        self.message_user(request, f"{queryset.count()} creatives rejected.")
    reject_creatives.short_description = "Reject selected creatives"

    def status_badge(self, obj: Creative) -> str:
        style = {
            Creative.Status.PENDING:  _AMBER,
            Creative.Status.APPROVED: _GREEN,
            Creative.Status.REJECTED: _RED,
        }
        fg, bg = style.get(obj.status, _GREY)
        return _badge(obj.get_status_display(), fg, bg)
    status_badge.short_description = "Status"

    def ad_link(self, obj: Creative) -> str:
        return format_html(
            '<a href="{}" target="_blank" style="font-size:11px;color:#1d4ed8;">View Ad</a>',
            obj.ad_url,
        )
    ad_link.short_description = "Ad URL"


# ---------------------------------------------------------------------------
# Bid
# ---------------------------------------------------------------------------

@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "brand",
        "match",
        "event_chip",
        "amount_display",
        "settled_badge",
        "tx_chip",
        "created_at",
    )
    list_display_links = ("id",)
    list_filter = ("event_type", "is_settled", "match__state")
    search_fields = ("brand__name", "match__team_a", "match__team_b", "tx_hash")
    list_select_related = ("brand", "match")
    list_per_page = 25
    ordering = ("-created_at",)
    readonly_fields = ("tx_hash", "is_settled", "created_at")

    fieldsets = (
        ("Bid", {
            "fields": ("match", "brand", "event_type", "amount", "creative"),
        }),
        ("Blockchain", {
            "fields": ("tx_hash", "is_settled"),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    def event_chip(self, obj: Bid) -> str:
        name = _EVENT_NAMES.get(obj.event_type, str(obj.event_type))
        fg, bg = _EVENT_STYLE.get(obj.event_type, _GREY)
        return _badge(name, fg, bg)
    event_chip.short_description = "Event"

    def amount_display(self, obj: Bid) -> str:
        return format_html(
            '<span style="font-weight:600;color:#111827;">{}</span>',
            _pkr(obj.amount),
        )
    amount_display.short_description = "Amount"

    def settled_badge(self, obj: Bid) -> str:
        if obj.is_settled:
            return _badge("Settled", *_GREEN)
        return _badge("Active", *_AMBER)
    settled_badge.short_description = "Status"

    def tx_chip(self, obj: Bid) -> str:
        return _tx_chip(obj.tx_hash)
    tx_chip.short_description = "TX Hash"


# ---------------------------------------------------------------------------
# AuctionResult
# ---------------------------------------------------------------------------

@admin.register(AuctionResult)
class AuctionResultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "event_chip",
        "trigger_number",
        "slot_badge",
        "winner",
        "amount_display",
        "tx_chip",
        "created_at",
    )
    list_display_links = ("id",)
    list_filter = ("event_type", "slot_position")
    search_fields = ("winner__name", "match__team_a", "match__team_b", "tx_hash")
    list_select_related = ("winner", "match")
    list_per_page = 25
    ordering = ("-created_at", "event_type", "trigger_number", "slot_position")
    readonly_fields = ("tx_hash", "created_at")

    fieldsets = (
        ("Auction Settlement", {
            "fields": ("match", "event_type", "trigger_number", "slot_position"),
        }),
        ("Winner", {
            "fields": ("winner", "amount", "creative_ref"),
        }),
        ("Blockchain", {
            "fields": ("tx_hash",),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    def event_chip(self, obj: AuctionResult) -> str:
        name = _EVENT_NAMES.get(obj.event_type, str(obj.event_type))
        fg, bg = _EVENT_STYLE.get(obj.event_type, _GREY)
        return _badge(name, fg, bg)
    event_chip.short_description = "Event"

    def slot_badge(self, obj: AuctionResult) -> str:
        label = f"Slot {obj.slot_position}"
        fg, bg = _SLOT_STYLE.get(obj.slot_position, _GREY)
        return _badge(label, fg, bg)
    slot_badge.short_description = "Slot"

    def amount_display(self, obj: AuctionResult) -> str:
        return format_html(
            '<span style="font-weight:600;color:#166534;">{}</span>',
            _pkr(obj.amount),
        )
    amount_display.short_description = "Amount"

    def tx_chip(self, obj: AuctionResult) -> str:
        return _tx_chip(obj.tx_hash)
    tx_chip.short_description = "TX Hash"


# ---------------------------------------------------------------------------
# Refund
# ---------------------------------------------------------------------------

@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "brand",
        "match",
        "amount_display",
        "fee_display",
        "tx_chip",
        "created_at",
    )
    list_display_links = ("id",)
    list_filter = ("match__state",)
    search_fields = ("brand__name", "match__team_a", "match__team_b", "tx_hash")
    list_select_related = ("brand", "match")
    list_per_page = 25
    ordering = ("-created_at",)
    readonly_fields = ("tx_hash", "created_at")

    fieldsets = (
        ("Refund", {
            "fields": ("match", "brand", "amount", "reservation_fee"),
        }),
        ("Blockchain", {
            "fields": ("tx_hash",),
        }),
        ("Timestamps", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    def amount_display(self, obj: Refund) -> str:
        return format_html(
            '<span style="font-weight:600;color:#1d4ed8;">{}</span>',
            _pkr(obj.amount),
        )
    amount_display.short_description = "Refund Amount"

    def fee_display(self, obj: Refund) -> str:
        if not obj.reservation_fee:
            return format_html('<span style="color:#9ca3af;">—</span>')
        return format_html(
            '<span style="color:#991b1b;font-size:12px;">- {}</span>',
            _pkr(obj.reservation_fee),
        )
    fee_display.short_description = "Fee Deducted"

    def tx_chip(self, obj: Refund) -> str:
        return _tx_chip(obj.tx_hash)
    tx_chip.short_description = "TX Hash"
