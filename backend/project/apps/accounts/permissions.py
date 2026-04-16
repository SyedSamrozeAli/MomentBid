from rest_framework.permissions import BasePermission


class IsBrandUser(BasePermission):
    """Allow access only to users linked with a brand."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "brand", None) is not None
        )


class IsBroadcasterUser(BasePermission):
    """Allow access only to users linked with a broadcaster."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "broadcaster", None) is not None
        )


class IsAdminRole(BasePermission):
    """Allow only platform admin role users."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and getattr(user, "role", "") == "admin"
        )
