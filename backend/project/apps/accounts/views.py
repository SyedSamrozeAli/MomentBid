from __future__ import annotations

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Brand, Broadcaster, User
from apps.accounts.permissions import IsBrandUser, IsBroadcasterUser
from apps.accounts.serializers import (
    BrandRegisterInputSerializer,
    BrandUpdateSerializer,
    BroadcasterRegisterInputSerializer,
    BroadcasterUpdateSerializer,
    LoginInputSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.blockchain import get_blockchain_service
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


def _build_file_url(request, file_field) -> str:
    if not file_field:
        return ""
    try:
        url = file_field.url
    except (ValueError, AttributeError):
        return ""
    return request.build_absolute_uri(url)


class RegisterBrandView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BrandRegisterInputSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        blockchain_service = get_blockchain_service()

        with transaction.atomic():
            address, private_key = blockchain_service.generate_wallet()
            brand = Brand(name=payload["brand_name"])
            brand.wallet_address = address
            brand.encrypt_private_key(private_key)
            brand.save()

            logo_file = payload.get("logo")
            if logo_file:
                brand.logo = logo_file
                brand.save(update_fields=["logo"])

            blockchain_service.fund_gas(address, 0.1)

            # Grant BRAND_ROLE on MomentBidCore (real chain only; mock is no-op)
            if hasattr(blockchain_service, "grant_brand_role"):
                blockchain_service.grant_brand_role(address)

            user = User.objects.create_user(
                username=payload["username"],
                email=payload.get("email", ""),
                password=payload["password"],
                role=User.Role.BRAND_OWNER,
                brand=brand,
            )

        refresh = RefreshToken.for_user(user)

        return CustomResponse.success(
            data={
                "user": UserSerializer(user).data,
                "brand": {
                    "id": brand.id,
                    "name": brand.name,
                    "wallet_address": brand.wallet_address,
                    "logo": _build_file_url(request, brand.logo),
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            message="Brand registered successfully",
            status_code=status.HTTP_201_CREATED,
        )


class RegisterBroadcasterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BroadcasterRegisterInputSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        blockchain_service = get_blockchain_service()

        with transaction.atomic():
            address, private_key = blockchain_service.generate_wallet()
            broadcaster = Broadcaster(name=payload["broadcaster_name"])
            broadcaster.wallet_address = address
            broadcaster.encrypt_private_key(private_key)
            broadcaster.save()

            logo_file = payload.get("logo")
            if logo_file:
                broadcaster.logo = logo_file
                broadcaster.save(update_fields=["logo"])

            blockchain_service.fund_gas(address, 0.1)

            # Grant BROADCASTER_ROLE on MomentBidCore + ExclusionManager (real chain only)
            if hasattr(blockchain_service, "grant_broadcaster_role"):
                blockchain_service.grant_broadcaster_role(address)

            user = User.objects.create_user(
                username=payload["username"],
                email=payload.get("email", ""),
                password=payload["password"],
                role=User.Role.BROADCASTER_OWNER,
                broadcaster=broadcaster,
            )

        refresh = RefreshToken.for_user(user)

        return CustomResponse.success(
            data={
                "user": UserSerializer(user).data,
                "broadcaster": {
                    "id": broadcaster.id,
                    "name": broadcaster.name,
                    "wallet_address": broadcaster.wallet_address,
                    "logo": _build_file_url(request, broadcaster.logo),
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            message="Broadcaster registered successfully",
            status_code=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginInputSerializer(data=request.data)
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        user = authenticate(
            request,
            username=payload["username"],
            password=payload["password"],
        )

        if user is None:
            return CustomResponse.error(
                message="Invalid username or password.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return CustomResponse.error(
                message="Your account is inactive. Please contact support.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        logo = ""
        brand_name = None
        broadcaster_name = None
        org_type = None

        if user.brand:
            org_type = "brand"
            logo = _build_file_url(request, user.brand.logo)
            brand_name = user.brand.name
        elif user.broadcaster:
            org_type = "broadcaster"
            logo = _build_file_url(request, user.broadcaster.logo)
            broadcaster_name = user.broadcaster.name

        return CustomResponse.success(
            data={
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "logo": logo,
                "brand_name": brand_name,
                "broadcaster_name": broadcaster_name,
                "org_type": org_type,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            message="Login successful.",
        )


class CurrentUserView(APIView):
    def get(self, request):
        user = request.user
        blockchain_service = get_blockchain_service()

        org = user.get_org()
        wallet_address = getattr(org, "wallet_address", "") if org else ""
        balance = (
            blockchain_service.get_mbt_balance(wallet_address) if wallet_address else 0
        )

        org_data = None
        if user.brand:
            org_data = {
                "type": "brand",
                "id": user.brand.id,
                "name": user.brand.name,
                "wallet_address": user.brand.wallet_address,
                "logo": _build_file_url(request, user.brand.logo),
            }
        elif user.broadcaster:
            org_data = {
                "type": "broadcaster",
                "id": user.broadcaster.id,
                "name": user.broadcaster.name,
                "wallet_address": user.broadcaster.wallet_address,
                "logo": _build_file_url(request, user.broadcaster.logo),
            }

        return CustomResponse.success(
            data={
                "user": {
                    **UserSerializer(user).data,
                    "profile_image": _build_file_url(request, user.profile_image),
                },
                "org": org_data,
                "balance": balance,
            }
        )


# ---------------------------------------------------------------------------
# Brand Dashboard
# ---------------------------------------------------------------------------


class BrandDashboardView(APIView):
    permission_classes = [IsBrandUser]

    def get(self, request):
        brand = request.user.brand

        from apps.bidding.models import Bid, Refund
        from apps.wallets.models import Deposit

        total_deposited = (
            Deposit.objects.filter(brand=brand, status="confirmed").aggregate(
                total=Sum("amount_pkr")
            )["total"]
            or 0
        )
        total_spent = (
            Bid.objects.filter(
                brand=brand, is_settled=True, is_cancelled=False
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        total_refunded = (
            Refund.objects.filter(brand=brand).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        active_bids_count = Bid.objects.filter(
            brand=brand, is_settled=False, is_cancelled=False
        ).count()
        escrowed_total = (
            Bid.objects.filter(
                brand=brand, is_settled=False, is_cancelled=False
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        # Balance = deposited - all escrowed (active bids) - permanently spent + refunded
        balance = int(total_deposited - escrowed_total - total_spent + total_refunded)

        return CustomResponse.success(
            data={
                "brand_name": brand.name,
                "wallet_address": brand.wallet_address,
                "balance_pkr": balance,
                "total_deposited": str(total_deposited),
                "total_spent": str(total_spent),
                "total_refunded": str(total_refunded),
                "active_bids_count": active_bids_count,
                "escrowed_total": str(escrowed_total),
            }
        )


# ---------------------------------------------------------------------------
# Broadcaster Dashboard
# ---------------------------------------------------------------------------


class BroadcasterDashboardView(APIView):
    permission_classes = [IsBroadcasterUser]

    def get(self, request):
        broadcaster = request.user.broadcaster

        from apps.bidding.models import AuctionResult
        from apps.matches.models import Match

        matches = Match.objects.filter(broadcaster=broadcaster)
        total_matches = matches.count()
        active_matches = matches.filter(
            state__in=[Match.State.OPEN, Match.State.ACTIVE]
        ).count()
        completed_matches = matches.filter(state=Match.State.COMPLETED).count()

        match_ids = list(matches.values_list("id", flat=True))
        total_auction_revenue = (
            AuctionResult.objects.filter(match_id__in=match_ids).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        broadcaster_share = total_auction_revenue * 95 // 100

        return CustomResponse.success(
            data={
                "broadcaster_name": broadcaster.name,
                "wallet_address": broadcaster.wallet_address,
                "total_earnings": str(broadcaster_share),
                "total_auction_revenue": str(total_auction_revenue),
                "total_matches": total_matches,
                "active_matches": active_matches,
                "completed_matches": completed_matches,
            }
        )


# ---------------------------------------------------------------------------
# Public list views (for exclusion group management UI)
# ---------------------------------------------------------------------------


class BrandListView(APIView):
    def get(self, request):
        brands = Brand.objects.only("id", "name", "wallet_address", "logo")
        data = [
            {
                "id": b.id,
                "name": b.name,
                "wallet_address": b.wallet_address,
                "logo": _build_file_url(request, b.logo),
            }
            for b in brands
        ]
        return CustomResponse.success(data=data)


class BroadcasterListView(APIView):
    def get(self, request):
        broadcasters = Broadcaster.objects.only("id", "name", "wallet_address", "logo")
        data = [
            {
                "id": b.id,
                "name": b.name,
                "wallet_address": b.wallet_address,
                "logo": _build_file_url(request, b.logo),
            }
            for b in broadcasters
        ]
        return CustomResponse.success(data=data)


class UserSelfUpdateView(APIView):
    def patch(self, request):
        serializer = UserUpdateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        user = request.user
        update_fields: list[str] = []

        if "username" in payload:
            user.username = payload["username"]
            update_fields.append("username")
        if "email" in payload:
            user.email = payload["email"]
            update_fields.append("email")
        if "profile_image" in payload:
            user.profile_image = payload["profile_image"]
            update_fields.append("profile_image")

        if update_fields:
            user.save(update_fields=update_fields)

        return CustomResponse.success(
            data={
                **UserSerializer(user).data,
                "profile_image": _build_file_url(request, user.profile_image),
            },
            message="Profile updated successfully.",
        )


class BrandSelfUpdateView(APIView):
    permission_classes = [IsBrandUser]

    def patch(self, request):
        if request.user.role != User.Role.BRAND_OWNER:
            return CustomResponse.error(
                message="Only brand owners can update brand details.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        brand = request.user.brand
        serializer = BrandUpdateSerializer(data=request.data, context={"brand": brand})
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        update_fields: list[str] = []

        if "name" in payload:
            brand.name = payload["name"]
            update_fields.append("name")
        if "logo" in payload:
            brand.logo = payload["logo"]
            update_fields.append("logo")

        if update_fields:
            brand.save(update_fields=update_fields)

        return CustomResponse.success(
            data={
                "id": brand.id,
                "name": brand.name,
                "wallet_address": brand.wallet_address,
                "logo": _build_file_url(request, brand.logo),
            },
            message="Brand updated successfully.",
        )


class BroadcasterSelfUpdateView(APIView):
    permission_classes = [IsBroadcasterUser]

    def patch(self, request):
        if request.user.role != User.Role.BROADCASTER_OWNER:
            return CustomResponse.error(
                message="Only broadcaster owners can update broadcaster details.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        broadcaster = request.user.broadcaster
        serializer = BroadcasterUpdateSerializer(
            data=request.data,
            context={"broadcaster": broadcaster},
        )
        if not serializer.is_valid():
            return serializer_validation_error_response(serializer)

        payload = serializer.validated_data
        update_fields: list[str] = []

        if "name" in payload:
            broadcaster.name = payload["name"]
            update_fields.append("name")
        if "logo" in payload:
            broadcaster.logo = payload["logo"]
            update_fields.append("logo")

        if update_fields:
            broadcaster.save(update_fields=update_fields)

        return CustomResponse.success(
            data={
                "id": broadcaster.id,
                "name": broadcaster.name,
                "wallet_address": broadcaster.wallet_address,
                "logo": _build_file_url(request, broadcaster.logo),
            },
            message="Broadcaster updated successfully.",
        )
