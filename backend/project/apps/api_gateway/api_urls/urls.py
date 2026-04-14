from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.accounts.api_urls.urls")),
    path("", include("apps.wallets.api_urls.urls")),
    path("", include("apps.matches.api_urls.urls")),
    path("", include("apps.bidding.api_urls.urls")),
]
