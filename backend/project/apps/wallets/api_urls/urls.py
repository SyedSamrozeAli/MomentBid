from django.urls import path

from apps.wallets.views import BalanceView, DepositListCreateView

urlpatterns = [
    path("deposits/", DepositListCreateView.as_view(), name="deposits"),
    path("balance/", BalanceView.as_view(), name="wallet-balance"),
]
