from django.urls import path

from apps.matches.views import (
    MatchDetailView,
    MatchEventConfigCreateView,
    MatchListCreateView,
    MatchOpenBiddingView,
)

urlpatterns = [
    path("matches/", MatchListCreateView.as_view(), name="match-list-create"),
    path("matches/<int:match_id>/", MatchDetailView.as_view(), name="match-detail"),
    path(
        "matches/<int:match_id>/event-configs/",
        MatchEventConfigCreateView.as_view(),
        name="match-event-config",
    ),
    path(
        "matches/<int:match_id>/open-bidding/",
        MatchOpenBiddingView.as_view(),
        name="match-open-bidding",
    ),
]
