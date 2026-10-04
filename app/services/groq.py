"""Shared, lazy Groq SDK integration for future non-financial AI operations."""

from collections.abc import Callable, Sequence
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import Settings


class GroqConfigurationError(RuntimeError):
    """Raised only when an LLM operation needs configuration that is absent."""


class LLMMessage(BaseModel):
    """Provider-neutral message shape. Agents own prompts, not this service."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class GroqService:
    """The only shared location that constructs a Groq client."""

    def __init__(
        self,
        settings: Settings,
        client_factory: Callable[[str], Any] | None = None,
    ) -> None:
        self._settings = settings
        self._client_factory = client_factory or self._create_client
        self._client: Any | None = None

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.groq_api_key and self._settings.groq_model)

    def complete(self, messages: Sequence[LLMMessage]) -> str:
        """Run a generic chat completion without logging or returning credentials."""

        if not self._settings.groq_api_key:
            raise GroqConfigurationError("GROQ_API_KEY is not configured.")
        if not self._settings.groq_model:
            raise GroqConfigurationError("GROQ_MODEL is not configured.")
        if not messages:
            raise ValueError("At least one LLM message is required.")

        if self._client is None:
            self._client = self._client_factory(self._settings.groq_api_key)
        response = self._client.chat.completions.create(
            model=self._settings.groq_model,
            messages=[message.model_dump() for message in messages],
        )
        return response.choices[0].message.content or ""

    @staticmethod
    def _create_client(api_key: str) -> Any:
        from groq import Groq

        return Groq(api_key=api_key)
