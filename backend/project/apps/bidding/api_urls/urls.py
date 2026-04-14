from django.urls import path

from apps.bidding.views import (
    AuctionResultListView,
    BudgetCapView,
    MatchBidIncreaseView,
    MatchBidListCreateView,
    RefundClaimView,
    RefundListView,
)

urlpatterns = [
    path("matches/<int:match_id>/bids/", MatchBidListCreateView.as_view(), name="match-bids"),
    path("matches/<int:match_id>/bids/<int:bid_id>/increase/", MatchBidIncreaseView.as_view(), name="match-bid-increase"),
    path("matches/<int:match_id>/budget-cap/", BudgetCapView.as_view(), name="match-budget-cap"),
    path("matches/<int:match_id>/auction-results/", AuctionResultListView.as_view(), name="match-auction-results"),
    path("matches/<int:match_id>/refunds/", RefundListView.as_view(), name="match-refunds"),
    path("matches/<int:match_id>/refunds/claim/", RefundClaimView.as_view(), name="match-refund-claim"),
]
