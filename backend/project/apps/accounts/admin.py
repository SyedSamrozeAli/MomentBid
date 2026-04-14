from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Brand, Broadcaster, User


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "wallet_address", "wire_funded", "created_at")
    search_fields = ("name", "wallet_address")


@admin.register(Broadcaster)
class BroadcasterAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "wallet_address", "wire_funded", "created_at")
    search_fields = ("name", "wallet_address")


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "id",
        "username",
        "email",
        "role",
        "brand",
        "broadcaster",
        "is_staff",
    )
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Organization",
            {
                "fields": ("role", "brand", "broadcaster"),
            },
        ),
    )
