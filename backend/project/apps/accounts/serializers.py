from __future__ import annotations

from rest_framework import serializers

from apps.accounts.models import Brand, Broadcaster, User


class BrandRegisterInputSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        error_messages={
            "required": "Username is required.",
            "blank": "Username cannot be empty.",
            "max_length": "Username must be 150 characters or fewer.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "required": "Password is required.",
            "blank": "Password cannot be empty.",
            "min_length": "Password must be at least 8 characters long.",
        },
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        error_messages={
            "invalid": "Please enter a valid email address.",
        },
    )
    brand_name = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Brand name is required.",
            "blank": "Brand name cannot be empty.",
            "max_length": "Brand name must be 255 characters or fewer.",
        },
    )
    logo = serializers.ImageField(
        required=False,
        allow_null=True,
        error_messages={
            "invalid": "Please upload a valid logo image.",
        },
    )

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value: str) -> str:
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return value

    def validate_brand_name(self, value: str) -> str:
        if Brand.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("This brand name is already registered.")
        return value


class BroadcasterRegisterInputSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        error_messages={
            "required": "Username is required.",
            "blank": "Username cannot be empty.",
            "max_length": "Username must be 150 characters or fewer.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "required": "Password is required.",
            "blank": "Password cannot be empty.",
            "min_length": "Password must be at least 8 characters long.",
        },
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        error_messages={
            "invalid": "Please enter a valid email address.",
        },
    )
    broadcaster_name = serializers.CharField(
        max_length=255,
        error_messages={
            "required": "Broadcaster name is required.",
            "blank": "Broadcaster name cannot be empty.",
            "max_length": "Broadcaster name must be 255 characters or fewer.",
        },
    )
    logo = serializers.ImageField(
        required=False,
        allow_null=True,
        error_messages={
            "invalid": "Please upload a valid logo image.",
        },
    )

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value: str) -> str:
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return value

    def validate_broadcaster_name(self, value: str) -> str:
        if Broadcaster.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError(
                "This broadcaster name is already registered."
            )
        return value


class LoginInputSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        error_messages={
            "required": "Username is required.",
            "blank": "Username cannot be empty.",
            "max_length": "Username must be 150 characters or fewer.",
        },
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={
            "required": "Password is required.",
            "blank": "Password cannot be empty.",
        },
    )


class UserUpdateSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=False,
        error_messages={
            "max_length": "Username must be 150 characters or fewer.",
            "blank": "Username cannot be empty.",
        },
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        error_messages={"invalid": "Please enter a valid email address."},
    )
    profile_image = serializers.ImageField(
        required=False,
        allow_null=True,
        error_messages={"invalid": "Please upload a valid profile image."},
    )

    def validate(self, attrs: dict) -> dict:
        if not attrs:
            raise serializers.ValidationError("No fields provided to update.")
        return attrs

    def validate_username(self, value: str) -> str:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if (
            user
            and User.objects.filter(username__iexact=value).exclude(id=user.id).exists()
        ):
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value: str) -> str:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if (
            value
            and user
            and User.objects.filter(email__iexact=value).exclude(id=user.id).exists()
        ):
            raise serializers.ValidationError("This email address is already in use.")
        return value


class BrandUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=False,
        error_messages={
            "max_length": "Brand name must be 255 characters or fewer.",
            "blank": "Brand name cannot be empty.",
        },
    )
    logo = serializers.ImageField(
        required=False,
        allow_null=True,
        error_messages={"invalid": "Please upload a valid logo image."},
    )

    def validate(self, attrs: dict) -> dict:
        if not attrs:
            raise serializers.ValidationError("No fields provided to update.")
        return attrs

    def validate_name(self, value: str) -> str:
        brand = self.context.get("brand")
        if (
            brand
            and Brand.objects.filter(name__iexact=value).exclude(id=brand.id).exists()
        ):
            raise serializers.ValidationError("This brand name is already registered.")
        return value


class BroadcasterUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=False,
        error_messages={
            "max_length": "Broadcaster name must be 255 characters or fewer.",
            "blank": "Broadcaster name cannot be empty.",
        },
    )
    logo = serializers.ImageField(
        required=False,
        allow_null=True,
        error_messages={"invalid": "Please upload a valid logo image."},
    )

    def validate(self, attrs: dict) -> dict:
        if not attrs:
            raise serializers.ValidationError("No fields provided to update.")
        return attrs

    def validate_name(self, value: str) -> str:
        broadcaster = self.context.get("broadcaster")
        if (
            broadcaster
            and Broadcaster.objects.filter(name__iexact=value)
            .exclude(id=broadcaster.id)
            .exists()
        ):
            raise serializers.ValidationError(
                "This broadcaster name is already registered."
            )
        return value


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "role")
