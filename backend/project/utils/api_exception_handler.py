from __future__ import annotations

import logging

from django.db import DatabaseError, IntegrityError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.views import exception_handler as drf_exception_handler

from utils.custom_response import CustomResponse

logger = logging.getLogger(__name__)


_UNIQUE_FIELD_MESSAGES = {
    "accounts_brand.name": "This brand name is already registered. Please choose a different name.",
    "accounts_broadcaster.name": "This broadcaster name is already registered. Please choose a different name.",
    "accounts_user.username": "This username is already taken. Please choose a different username.",
    "accounts_user.email": "This email address is already in use. Please use a different email.",
    "matches_match.on_chain_match_id": "A duplicate on-chain match id was generated. Please retry match creation.",
    "bidding_bid.match_id, bidding_bid.brand_id, bidding_bid.event_type": "You already have a bid for this event in this match.",
    "matches_matcheventconfig.match_id, matches_matcheventconfig.event_type": "This event type is already configured for the selected match.",
}


def _build_friendly_message_from_integrity_error(exc: IntegrityError) -> str:
    raw_error = str(exc)
    lowered = raw_error.lower()

    if "unique constraint failed" in lowered:
        parts = raw_error.split(":", 1)
        if len(parts) == 2:
            fields = parts[1].strip()
            if fields in _UNIQUE_FIELD_MESSAGES:
                return _UNIQUE_FIELD_MESSAGES[fields]
            return "This record already exists with the same unique information. Please use different values."

    if "not null constraint failed" in lowered:
        return "Some required information is missing. Please fill all required fields and try again."

    if "foreign key constraint failed" in lowered:
        return "The selected related record does not exist or cannot be used."

    return "We could not save your request due to a data conflict. Please review your input and try again."


def _normalize_validation_error_detail(detail: object) -> object:
    if isinstance(detail, dict):
        return {
            str(field): (
                [str(error) for error in errors]
                if isinstance(errors, list)
                else [str(errors)]
            )
            for field, errors in detail.items()
        }
    if isinstance(detail, list):
        return [str(item) for item in detail]
    return str(detail)


def custom_exception_handler(exc: Exception, context: dict):
    """Global API exception handler that returns user-friendly error envelopes."""

    response = drf_exception_handler(exc, context)

    if response is not None:
        if isinstance(exc, ValidationError):
            return CustomResponse.error(
                message="Please correct the highlighted fields and try again.",
                error=_normalize_validation_error_detail(response.data),
                status_code=response.status_code,
            )

        message = {
            status.HTTP_401_UNAUTHORIZED: "You are not authenticated. Please log in and try again.",
            status.HTTP_403_FORBIDDEN: "You do not have permission to perform this action.",
            status.HTTP_404_NOT_FOUND: "The requested resource was not found.",
            status.HTTP_405_METHOD_NOT_ALLOWED: "This request method is not allowed for this endpoint.",
            status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests. Please wait and try again shortly.",
        }.get(response.status_code, "Your request could not be processed.")

        error_payload = _normalize_validation_error_detail(response.data)
        return CustomResponse.error(
            message=message,
            error=error_payload,
            status_code=response.status_code,
        )

    if isinstance(exc, IntegrityError):
        return CustomResponse.error(
            message=_build_friendly_message_from_integrity_error(exc),
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, DatabaseError):
        logger.exception("Database error while processing API request", exc_info=exc)
        return CustomResponse.error(
            message="We could not process your request due to a temporary database issue. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    logger.exception("Unhandled API error", exc_info=exc)
    return CustomResponse.error(
        message="Something went wrong while processing your request. Please try again.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
