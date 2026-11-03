from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Intent = Literal[
    "greeting",
    "order_tracking",
    "payment_issue",
    "current_time",
    "general_question",
    "unknown",
]
RiskProfile = Literal["low", "medium", "high", "unknown"]
Priority = Literal["low", "medium", "high"]


class ChatTurn(BaseModel):
    """One earlier message, sent by the browser in incognito mode (the server stores nothing)."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=20000)


class IngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    incognito: bool = Field(
        default=False,
        description="If true, nothing is saved to the database for this message.",
    )

    history: list[ChatTurn] = Field(
        default_factory=list,
        max_length=12,
        description="Incognito only: the recent messages, since the server keeps none.",
    )

    session_id:str | None =Field(
        default=None,
        min_length=1,
        max_length=100,
        description="optional conversation session identifier"
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
        description="The user's original message.",
        examples=["Where is my order?"],
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot contain only whitespace.")
        return value


class RenameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Title cannot be empty.")
        return value


class TokenMetadata(BaseModel):
    estimated_input_tokens: int = Field(default=0, ge=0)
    note: str = "Estimated locally; may differ from provider token counts."


class IngestionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Intent
    risk_profile: RiskProfile
    priority: Priority
    requires_action: bool
    summary: str = Field(min_length=1, max_length=500)
    token_metadata: TokenMetadata = Field(default_factory=TokenMetadata)
