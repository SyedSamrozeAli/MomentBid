from django.contrib import admin
from django.utils.html import format_html

from apps.wallets.models import Deposit, Transaction


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


def _tx_chip(tx_hash: str) -> str:
    if not tx_hash:
        return "—"
    short = f"{tx_hash[:8]}…{tx_hash[-6:]}"
    return format_html(
        '<code style="background:#f8fafc;color:#475569;padding:2px 6px;'
        'border-radius:3px;font-size:11px;border:1px solid #e2e8f0;">{}</code>',
        short,
    )


_GREEN = ("#166534", "#dcfce7")
_AMBER = ("#854d0e", "#fef9c3")
_RED = ("#991b1b", "#fee2e2")
_BLUE = ("#1d4ed8", "#dbeafe")
_PURPLE = ("#5b21b6", "#ede9fe")
_GREY = ("#374151", "#f3f4f6")

_STATUS_STYLE: dict[str, tuple[str, str]] = {
    "pending": _AMBER,
    "confirmed": _GREEN,
    "failed": _RED,
}

# Semantic action grouping:
#   mint / funding        → green
#   bid actions           → blue
#   match lifecycle       → purple
#   refund / claim        → amber
_ACTION_STYLE: dict[str, tuple[str, str]] = {
    "mint": _GREEN,
    "approve": _GREEN,
    "place_bid": _BLUE,
    "increase_bid": _BLUE,
    "set_budget_cap": _BLUE,
    "create_match": _PURPLE,
    "configure_event": _PURPLE,
    "open_bidding": _PURPLE,
    "trigger_event": _AMBER,
    "claim_refund": _AMBER,
}


# ---------------------------------------------------------------------------
# Deposit
# ---------------------------------------------------------------------------


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "brand",
        "amount_display",
        "status_badge",
        "tx_chip",
        "created_at",
    )
    list_display_links = ("id",)
    list_filter = ("status",)
    search_fields = ("brand__name", "tx_hash")
    list_select_related = ("brand",)
    list_per_page = 25
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("tx_hash", "status", "created_at")

    fieldsets = (
        (
            "Deposit",
            {
                "fields": ("brand", "amount_pkr"),
            },
        ),
        (
            "Blockchain",
            {
                "fields": ("tx_hash", "status"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at",),
                "classes": ("collapse",),
            },
        ),
    )

    def amount_display(self, obj: Deposit) -> str:
        return format_html(
            '<span style="font-weight:600;color:#166534;">{}</span>',
            _pkr(obj.amount_pkr),
        )

    amount_display.short_description = "Amount"

    def status_badge(self, obj: Deposit) -> str:
        fg, bg = _STATUS_STYLE.get(obj.status, _GREY)
        return _badge(obj.status.capitalize(), fg, bg)

    status_badge.short_description = "Status"

    def tx_chip(self, obj: Deposit) -> str:
        return _tx_chip(obj.tx_hash)

    tx_chip.short_description = "TX Hash"


# ---------------------------------------------------------------------------
# Transaction
# ---------------------------------------------------------------------------


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "action_badge",
        "status_badge",
        "actor",
        "amount_display",
        "tx_chip",
        "gas_display",
        "created_at",
    )
    list_display_links = ("id",)
    list_filter = ("status", "action")
    search_fields = ("tx_hash", "brand__name", "broadcaster__name")
    list_select_related = ("brand", "broadcaster", "initiated_by")
    list_per_page = 25
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = (
        "tx_hash",
        "status",
        "gas_used",
        "error_message",
        "metadata",
        "created_at",
    )

    fieldsets = (
        (
            "Transaction",
            {
                "fields": ("action", "brand", "broadcaster", "initiated_by"),
            },
        ),
        (
            "Blockchain",
            {
                "fields": ("tx_hash", "status", "gas_used", "error_message"),
            },
        ),
        (
            "Metadata",
            {
                "fields": ("metadata",),
                "classes": ("collapse",),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at",),
                "classes": ("collapse",),
            },
        ),
    )

    def action_badge(self, obj: Transaction) -> str:
        fg, bg = _ACTION_STYLE.get(obj.action, _GREY)
        label = obj.action.replace("_", " ").title()
        return _badge(label, fg, bg)

    action_badge.short_description = "Action"

    def status_badge(self, obj: Transaction) -> str:
        fg, bg = _STATUS_STYLE.get(obj.status, _GREY)
        return _badge(obj.status.capitalize(), fg, bg)

    status_badge.short_description = "Status"

    def actor(self, obj: Transaction) -> str:
        if obj.brand:
            return format_html('<span style="color:#1d4ed8;">{}</span>', obj.brand.name)
        if obj.broadcaster:
            return format_html(
                '<span style="color:#5b21b6;">{}</span>', obj.broadcaster.name
            )
        return format_html('<span style="color:#9ca3af;">{}</span>', "—")

    actor.short_description = "Actor"

    def amount_display(self, obj: Transaction) -> str:
        amount = obj.metadata.get("amount_pkr") or obj.metadata.get("cap")
        if amount:
            try:
                formatted_amount = f"PKR {int(float(amount)):,}"
                return format_html(
                    '<span style="font-weight:500;">{}</span>',
                    formatted_amount,
                )
            except (ValueError, TypeError):
                pass
        return format_html('<span style="color:#9ca3af;">{}</span>', "—")

    amount_display.short_description = "Amount"

    def gas_display(self, obj: Transaction) -> str:
        if obj.gas_used:
            formatted_gas = f"{int(obj.gas_used):,}"
            return format_html(
                '<span style="font-size:11px;color:#6b7280;">{}</span>',
                formatted_gas,
            )
        return format_html('<span style="color:#9ca3af;">{}</span>', "—")

    gas_display.short_description = "Gas Used"

    def tx_chip(self, obj: Transaction) -> str:
        return _tx_chip(obj.tx_hash)

    tx_chip.short_description = "TX Hash"
