from django.urls import include, path

urlpatterns = [
    # Auth: /api/auth/...
    path("auth/", include("apps.accounts.api_urls.urls")),
    # Org-level: /api/brands/..., /api/broadcasters/...
    path("", include("apps.accounts.api_urls.org_urls")),
    # Wallet + deposits: /api/deposits/, /api/balance/
    path("", include("apps.wallets.api_urls.urls")),
    # Matches + exclusion groups + simulator: /api/matches/..., /api/exclusion-groups/..., /api/simulator/...
    path("", include("apps.matches.api_urls.urls")),
    # Bidding: /api/matches/{id}/bids/, /api/matches/{id}/auction-results/, etc.
    path("", include("apps.bidding.api_urls.urls")),
]
