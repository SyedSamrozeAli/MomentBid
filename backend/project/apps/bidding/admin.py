from django.contrib import admin

from apps.bidding.models import AuctionResult, Bid, Refund


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "brand",
        "event_type",
        "amount",
        "is_settled",
        "created_at",
    )
    list_filter = ("event_type", "is_settled")
    search_fields = ("brand__name", "tx_hash", "match__team_a", "match__team_b")


@admin.register(AuctionResult)
class AuctionResultAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "event_type",
        "trigger_number",
        "slot_position",
        "winner",
        "amount",
    )
    list_filter = ("event_type",)


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "match",
        "brand",
        "amount",
        "reservation_fee",
        "tx_hash",
        "created_at",
    )
