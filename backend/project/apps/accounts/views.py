from __future__ import annotations

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
    BroadcasterRegisterInputSerializer,
    UserSerializer,
)
from apps.blockchain import get_blockchain_service
from utils.custom_response import CustomResponse
from utils.validation import serializer_validation_error_response


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
            brand = Brand(
                name=payload["brand_name"], logo_url=payload.get("logo_url", "")
            )
            brand.wallet_address = address
            brand.encrypt_private_key(private_key)
            brand.save()

            blockchain_service.fund_gas(address, 0.1)

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
            broadcaster = Broadcaster(
                name=payload["broadcaster_name"],
                logo_url=payload.get("logo_url", ""),
            )
            broadcaster.wallet_address = address
            broadcaster.encrypt_private_key(private_key)
            broadcaster.save()

            blockchain_service.fund_gas(address, 0.1)

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
                },
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            message="Broadcaster registered successfully",
            status_code=status.HTTP_201_CREATED,
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
            }
        elif user.broadcaster:
            org_data = {
                "type": "broadcaster",
                "id": user.broadcaster.id,
                "name": user.broadcaster.name,
                "wallet_address": user.broadcaster.wallet_address,
            }

        return CustomResponse.success(
            data={
                "user": UserSerializer(user).data,
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
        blockchain_service = get_blockchain_service()
        balance = blockchain_service.get_mbt_balance(brand.wallet_address)

        from apps.bidding.models import Bid, Refund
        from apps.wallets.models import Deposit

        total_deposited = (
            Deposit.objects.filter(brand=brand, status="confirmed").aggregate(
                total=Sum("amount_pkr")
            )["total"]
            or 0
        )
        total_spent = (
            Bid.objects.filter(brand=brand, is_settled=True).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )
        total_refunded = (
            Refund.objects.filter(brand=brand).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        active_bids_count = Bid.objects.filter(brand=brand, is_settled=False).count()
        escrowed_total = (
            Bid.objects.filter(brand=brand, is_settled=False).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

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
        brands = Brand.objects.only("id", "name", "wallet_address")
        data = [
            {"id": b.id, "name": b.name, "wallet_address": b.wallet_address}
            for b in brands
        ]
        return CustomResponse.success(data=data)


class BroadcasterListView(APIView):
    def get(self, request):
        broadcasters = Broadcaster.objects.only("id", "name", "wallet_address")
        data = [
            {"id": b.id, "name": b.name, "wallet_address": b.wallet_address}
            for b in broadcasters
        ]
        return CustomResponse.success(data=data)
