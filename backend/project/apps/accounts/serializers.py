from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import User


class BrandRegisterInputSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    brand_name = serializers.CharField(max_length=255)
    logo_url = serializers.URLField(required=False, allow_blank=True)


class BroadcasterRegisterInputSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)
    broadcaster_name = serializers.CharField(max_length=255)
    logo_url = serializers.URLField(required=False, allow_blank=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role")
