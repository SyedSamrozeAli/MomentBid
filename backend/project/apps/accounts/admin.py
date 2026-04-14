from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html

from apps.accounts.models import Brand, Broadcaster, User


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


# Semantic palette: light background + dark text
_GREEN = ("#166534", "#dcfce7")
_AMBER = ("#854d0e", "#fef9c3")
_RED = ("#991b1b", "#fee2e2")
_BLUE = ("#1d4ed8", "#dbeafe")
_PURPLE = ("#5b21b6", "#ede9fe")
_GREY = ("#374151", "#f3f4f6")


def _wallet_chip(address: str) -> str:
    short = f"{address[:6]}…{address[-4:]}"
    return format_html(
        '<code style="background:#f8fafc;color:#475569;padding:2px 6px;'
        'border-radius:3px;font-size:11px;border:1px solid #e2e8f0;">{}</code>',
        short,
    )


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------


class BrandUserInline(admin.TabularInline):
    model = User
    fk_name = "brand"
    fields = ("username", "email", "role", "is_active")
    readonly_fields = ("username", "email", "role", "is_active")
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name = "Team Member"
    verbose_name_plural = "Team Members"


class BroadcasterUserInline(admin.TabularInline):
    model = User
    fk_name = "broadcaster"
    fields = ("username", "email", "role", "is_active")
    readonly_fields = ("username", "email", "role", "is_active")
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name = "Team Member"
    verbose_name_plural = "Team Members"


# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "wallet_chip",
        "gas_badge",
        "user_count",
        "bid_count",
        "created_at",
    )
    list_display_links = ("id", "name")
    search_fields = ("name", "wallet_address")
    list_per_page = 25
    ordering = ("-created_at",)
    list_select_related = True
    inlines = [BrandUserInline]
    readonly_fields = ("wallet_address", "created_at")
    exclude = ("encrypted_private_key",)

    fieldsets = (
        ("Organisation", {"fields": ("name", "logo_url")}),
        ("Wallet", {"fields": ("wallet_address", "wire_funded")}),
        ("Meta", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    def wallet_chip(self, obj: Brand) -> str:
        return _wallet_chip(obj.wallet_address) if obj.wallet_address else "—"

    wallet_chip.short_description = "Wallet"

    def gas_badge(self, obj: Brand) -> str:
        fg, bg = _GREEN if obj.wire_funded else _AMBER
        label = "Funded" if obj.wire_funded else "Needs gas"
        return _badge(label, fg, bg)

    gas_badge.short_description = "WIRE Gas"

    def user_count(self, obj: Brand) -> int:
        return obj.users.count()

    user_count.short_description = "Users"

    def bid_count(self, obj: Brand) -> int:
        return obj.bids.count()

    bid_count.short_description = "Bids"


# ---------------------------------------------------------------------------
# Broadcaster
# ---------------------------------------------------------------------------


@admin.register(Broadcaster)
class BroadcasterAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "wallet_chip",
        "gas_badge",
        "match_count",
        "user_count",
        "created_at",
    )
    list_display_links = ("id", "name")
    search_fields = ("name", "wallet_address")
    list_per_page = 25
    ordering = ("-created_at",)
    list_select_related = True
    inlines = [BroadcasterUserInline]
    readonly_fields = ("wallet_address", "created_at")
    exclude = ("encrypted_private_key",)

    fieldsets = (
        ("Organisation", {"fields": ("name", "logo_url")}),
        ("Wallet", {"fields": ("wallet_address", "wire_funded")}),
        ("Meta", {"fields": ("created_at",), "classes": ("collapse",)}),
    )

    def wallet_chip(self, obj: Broadcaster) -> str:
        return _wallet_chip(obj.wallet_address) if obj.wallet_address else "—"

    wallet_chip.short_description = "Wallet"

    def gas_badge(self, obj: Broadcaster) -> str:
        fg, bg = _GREEN if obj.wire_funded else _AMBER
        label = "Funded" if obj.wire_funded else "Needs gas"
        return _badge(label, fg, bg)

    gas_badge.short_description = "WIRE Gas"

    def match_count(self, obj: Broadcaster) -> int:
        return obj.matches.count()

    match_count.short_description = "Matches"

    def user_count(self, obj: Broadcaster) -> int:
        return obj.users.count()

    user_count.short_description = "Users"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

_ROLE_STYLE: dict[str, tuple[str, str]] = {
    "brand_owner": _BLUE,
    "brand_member": _GREY,
    "broadcaster_owner": _PURPLE,
    "broadcaster_member": _GREY,
    "admin": _RED,
}


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "id",
        "username",
        "email",
        "role_badge",
        "org_label",
        "is_active",
        "date_joined",
    )
    list_display_links = ("id", "username")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("username", "email", "brand__name", "broadcaster__name")
    list_per_page = 25
    ordering = ("-date_joined",)
    list_select_related = ("brand", "broadcaster")

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("MomentBid Organisation", {"fields": ("role", "brand", "broadcaster")}),
    )

    def role_badge(self, obj: User) -> str:
        fg, bg = _ROLE_STYLE.get(obj.role, _GREY)
        label = obj.role.replace("_", " ").title()
        return _badge(label, fg, bg)

    role_badge.short_description = "Role"

    def org_label(self, obj: User) -> str:
        if obj.brand:
            return format_html('<span style="color:#1d4ed8;">{}</span>', obj.brand.name)
        if obj.broadcaster:
            return format_html(
                '<span style="color:#5b21b6;">{}</span>', obj.broadcaster.name
            )
        return format_html('<span style="color:#9ca3af;">{}</span>', "—")

    org_label.short_description = "Organisation"
