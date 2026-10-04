import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    """Runtime settings deliberately limited to the MVP foundation."""

    app_name: str = "TADBIR API"
    api_prefix: str = "/api/v1"
    groq_api_key: str | None = field(default=None, repr=False)
    groq_model: str | None = None

    @classmethod
    def from_environment(cls) -> "Settings":
        """Load optional LLM configuration without requiring it at startup."""

        return cls(
            groq_api_key=os.getenv("GROQ_API_KEY") or None,
            groq_model=os.getenv("GROQ_MODEL") or None,
        )


settings = Settings.from_environment()
