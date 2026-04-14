from django.urls import path

from apps.accounts.views import (
    BrandDashboardView,
    BrandListView,
    BroadcasterDashboardView,
    BroadcasterListView,
)

urlpatterns = [
    path("brands/me/dashboard/", BrandDashboardView.as_view(), name="brand-dashboard"),
    path("broadcasters/me/dashboard/", BroadcasterDashboardView.as_view(), name="broadcaster-dashboard"),
    path("brands/", BrandListView.as_view(), name="brand-list"),
    path("broadcasters/", BroadcasterListView.as_view(), name="broadcaster-list"),
]
