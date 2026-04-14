from __future__ import annotations

from rest_framework import status

from utils.custom_response import CustomResponse


def _normalize_errors(detail: object) -> object:
    if isinstance(detail, dict):
        return {str(key): _normalize_errors(value) for key, value in detail.items()}
    if isinstance(detail, list):
        return [_normalize_errors(item) for item in detail]
    return str(detail)


def serializer_validation_error_response(
    serializer, message: str = "Please correct the highlighted fields and try again."
):
    return CustomResponse.error(
        message=message,
        error=_normalize_errors(serializer.errors),
        status_code=status.HTTP_400_BAD_REQUEST,
    )
