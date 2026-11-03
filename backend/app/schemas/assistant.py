
from pydantic import BaseModel, Field

from app.schemas.ingestion import IngestionResult


class TokenCount(BaseModel):
    """Tokens used by one LLM call."""

    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    estimated: bool = Field(description="True if counted locally because Groq didn't report usage.")


class TokenUsage(BaseModel):
    """Tokens used to answer one message: the classification call plus the reply call."""

    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    estimated: bool
    classification: TokenCount
    reply: TokenCount

    @classmethod
    def combine(cls, classification: dict, reply: dict) -> "TokenUsage":
        # A missing count (should not happen) becomes 0 and is flagged as estimated,
        # so token counting can never break a reply.
        missing = {"input_tokens": 0, "output_tokens": 0, "estimated": True}
        first = TokenCount(**{**missing, **classification})
        second = TokenCount(**{**missing, **reply})
        return cls(
            input_tokens=first.input_tokens + second.input_tokens,
            output_tokens=first.output_tokens + second.output_tokens,
            estimated=first.estimated or second.estimated,
            classification=first,
            reply=second,
        )


class AssistantResult(IngestionResult):
    """Week 2 response: intent analysis plus generated answer."""

    session_id: str = Field(min_length=1,description="Conversation Session Identifier")

    response_markdown: str = Field(
        min_length=1,
        description="LLM-generated answer formatted as Markdown.",
    )

    token_usage: TokenUsage | None = Field(
        default=None,
        description="Input/output tokens for this message (both LLM calls).",
    )
