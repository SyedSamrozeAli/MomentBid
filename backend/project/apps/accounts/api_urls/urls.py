from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import (
    CurrentUserView,
    RegisterBrandView,
    RegisterBroadcasterView,
)

urlpatterns = [
    path("register/brand/", RegisterBrandView.as_view(), name="register-brand"),
    path("register/broadcaster/", RegisterBroadcasterView.as_view(), name="register-broadcaster"),
    path("login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
]
