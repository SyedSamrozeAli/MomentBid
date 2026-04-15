from django.urls import path

from apps.bidding.views import (
    AuctionResultListView,
    BrandActiveBidListView,
    BrandBidHistoryView,
    BrandCancelledBidListView,
    BudgetCapView,
    CreativeApproveView,
    CreativeDetailView,
    CreativeDisapproveView,
    CreativeListCreateView,
    MatchBidCancelView,
    MatchBidIncreaseView,
    MatchBidLeaderboardView,
    MatchBidListCreateView,
    MatchBidListView,
    RefundClaimView,
    RefundListView,
)

urlpatterns = [
    path("bids/me/history/", BrandBidHistoryView.as_view(), name="my-bids-history"),
    path("bids/me/active/", BrandActiveBidListView.as_view(), name="my-active-bids"),
    path(
        "bids/me/cancelled/",
        BrandCancelledBidListView.as_view(),
        name="my-cancelled-bids",
    ),
    # Creatives (brand uploads ads before bidding)
    path("creatives/", CreativeListCreateView.as_view(), name="creatives"),
    path(
        "creatives/<int:creative_id>/",
        CreativeDetailView.as_view(),
        name="creative-detail",
    ),
    path(
        "creatives/<int:creative_id>/approve/",
        CreativeApproveView.as_view(),
        name="creative-approve",
    ),
    path(
        "creatives/<int:creative_id>/disapprove/",
        CreativeDisapproveView.as_view(),
        name="creative-disapprove",
    ),
    # Bids — place/increase (POST) kept on base path; read-only views separate
    path(
        "matches/<int:match_id>/bids/",
        MatchBidListCreateView.as_view(),
        name="match-bids",
    ),
    path(
        "matches/<int:match_id>/bids/all/",
        MatchBidListView.as_view(),
        name="match-bids-list",
    ),
    path(
        "matches/<int:match_id>/bids/leaderboard/",
        MatchBidLeaderboardView.as_view(),
        name="match-bids-leaderboard",
    ),
    path(
        "matches/<int:match_id>/bids/<int:bid_id>/increase/",
        MatchBidIncreaseView.as_view(),
        name="match-bid-increase",
    ),
    path(
        "matches/<int:match_id>/bids/<int:bid_id>/cancel/",
        MatchBidCancelView.as_view(),
        name="match-bid-cancel",
    ),
    path(
        "matches/<int:match_id>/budget-cap/",
        BudgetCapView.as_view(),
        name="match-budget-cap",
    ),
    # Auction results & refunds
    path(
        "matches/<int:match_id>/auction-results/",
        AuctionResultListView.as_view(),
        name="match-auction-results",
    ),
    path(
        "matches/<int:match_id>/refunds/",
        RefundListView.as_view(),
        name="match-refunds",
    ),
    path(
        "matches/<int:match_id>/refunds/claim/",
        RefundClaimView.as_view(),
        name="match-refund-claim",
    ),
]
