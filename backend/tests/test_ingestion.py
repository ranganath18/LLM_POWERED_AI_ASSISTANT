import pytest
from pydantic import ValidationError

from app.schemas.ingestion import IngestionRequest, IngestionResult


def test_request_trims_message():
    request = IngestionRequest(message="  Hi there  ")
    assert request.message == "Hi there"


def test_request_rejects_blank_message():
    with pytest.raises(ValidationError):
        IngestionRequest(message="   ")


def test_result_rejects_invalid_intent():
    with pytest.raises(ValidationError):
        IngestionResult(
            intent="shopping",
            risk_profile="low",
            priority="low",
            requires_action=False,
            summary="A test",
        )


def test_result_accepts_valid_data():
    result = IngestionResult(
        intent="greeting",
        risk_profile="low",
        priority="low",
        requires_action=False,
        summary="The user greeted the assistant.",
    )
    assert result.intent == "greeting"
    assert result.token_metadata.estimated_input_tokens == 0
