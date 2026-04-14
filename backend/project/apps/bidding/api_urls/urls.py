from django.urls import path

from apps.bidding.views import (
    BudgetCapView,
    MatchBidIncreaseView,
    MatchBidListCreateView,
)

urlpatterns = [
    path(
        "matches/<int:match_id>/bids/",
        MatchBidListCreateView.as_view(),
        name="match-bids",
    ),
    path(
        "matches/<int:match_id>/bids/<int:bid_id>/increase/",
        MatchBidIncreaseView.as_view(),
        name="match-bid-increase",
    ),
    path(
        "matches/<int:match_id>/budget-cap/",
        BudgetCapView.as_view(),
        name="match-budget-cap",
    ),
]
