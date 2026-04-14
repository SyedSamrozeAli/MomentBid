from django.urls import path

from apps.accounts.views import (
    BrandDashboardView,
    BrandListView,
    BrandSelfUpdateView,
    BroadcasterDashboardView,
    BroadcasterListView,
    BroadcasterSelfUpdateView,
)

urlpatterns = [
    path("brands/me/dashboard/", BrandDashboardView.as_view(), name="brand-dashboard"),
    path("brands/me/", BrandSelfUpdateView.as_view(), name="brand-self-update"),
    path(
        "broadcasters/me/dashboard/",
        BroadcasterDashboardView.as_view(),
        name="broadcaster-dashboard",
    ),
    path(
        "broadcasters/me/",
        BroadcasterSelfUpdateView.as_view(),
        name="broadcaster-self-update",
    ),
    path("brands/", BrandListView.as_view(), name="brand-list"),
    path("broadcasters/", BroadcasterListView.as_view(), name="broadcaster-list"),
]
