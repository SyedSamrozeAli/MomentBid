from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response


class CustomResponse:
    """Consistent API response envelope."""

    @staticmethod
    def success(
        data: Any = None,
        message: str = "Success",
        status_code: int = status.HTTP_200_OK,
    ) -> Response:
        return Response(
            {
                "success": True,
                "message": message,
                "data": data,
                "error": None,
            },
            status=status_code,
        )

    @staticmethod
    def error(
        message: str = "Request failed",
        error: Any = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ) -> Response:
        return Response(
            {
                "success": False,
                "message": message,
                "data": None,
                "error": error,
            },
            status=status_code,
        )
