from django.contrib import admin

from apps.wallets.models import Deposit, Transaction


@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = ("id", "brand", "amount_pkr", "status", "tx_hash", "created_at")
    list_filter = ("status",)
    search_fields = ("brand__name", "tx_hash")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "action",
        "status",
        "brand",
        "broadcaster",
        "tx_hash",
        "created_at",
    )
    list_filter = ("status", "action")
    search_fields = ("tx_hash", "brand__name", "broadcaster__name")
