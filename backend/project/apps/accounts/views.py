from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Brand, Broadcaster, User
from apps.accounts.serializers import (
    BrandRegisterInputSerializer,
    BroadcasterRegisterInputSerializer,
    UserSerializer,
)
from apps.blockchain import get_blockchain_service
from utils.custom_response import CustomResponse


class RegisterBrandView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BrandRegisterInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

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
        serializer.is_valid(raise_exception=True)

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
