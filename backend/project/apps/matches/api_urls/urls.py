from django.urls import path

from apps.matches.views import (
    ExclusionGroupDetailView,
    ExclusionGroupListCreateView,
    ExclusionGroupMemberView,
    MatchDetailView,
    MatchEventConfigCreateView,
    MatchEventConfigDetailView,
    MatchListCreateView,
    MatchOpenBiddingView,
    SimulatorCancelView,
    SimulatorCompleteView,
    SimulatorStartView,
    SimulatorStatusView,
    SimulatorTriggerEventView,
)

urlpatterns = [
    # Matches
    path("matches/", MatchListCreateView.as_view(), name="match-list-create"),
    path("matches/<int:match_id>/", MatchDetailView.as_view(), name="match-detail"),
    path("matches/<int:match_id>/event-configs/", MatchEventConfigCreateView.as_view(), name="match-event-config"),
    path("matches/<int:match_id>/event-configs/<int:event_type>/", MatchEventConfigDetailView.as_view(), name="match-event-config-detail"),
    path("matches/<int:match_id>/open-bidding/", MatchOpenBiddingView.as_view(), name="match-open-bidding"),

    # Exclusion Groups
    path("exclusion-groups/", ExclusionGroupListCreateView.as_view(), name="exclusion-group-list-create"),
    path("exclusion-groups/<int:group_id>/", ExclusionGroupDetailView.as_view(), name="exclusion-group-detail"),
    path("exclusion-groups/<int:group_id>/members/", ExclusionGroupMemberView.as_view(), name="exclusion-group-members"),
    path("exclusion-groups/<int:group_id>/members/<int:brand_id>/", ExclusionGroupMemberView.as_view(), name="exclusion-group-member-delete"),

    # Simulator (admin-only)
    path("simulator/<int:match_id>/start/", SimulatorStartView.as_view(), name="simulator-start"),
    path("simulator/<int:match_id>/complete/", SimulatorCompleteView.as_view(), name="simulator-complete"),
    path("simulator/<int:match_id>/cancel/", SimulatorCancelView.as_view(), name="simulator-cancel"),
    path("simulator/<int:match_id>/trigger-event/", SimulatorTriggerEventView.as_view(), name="simulator-trigger-event"),
    path("simulator/<int:match_id>/status/", SimulatorStatusView.as_view(), name="simulator-status"),
]
