import os
from dataclasses import dataclass, field
from pathlib import Path

# Repository-root `.env` (git-ignored). Real environment variables win.
DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def read_env_file(path: Path) -> dict[str, str]:
    """Parse simple KEY=VALUE lines without logging or returning anything else.

    Whitespace around keys/values and matching surrounding quotes are removed,
    so `GROQ_MODEL= model-name` and `GROQ_MODEL="model-name"` both work.
    """

    values: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return values
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key:
            values[key] = value
    return values


@dataclass(frozen=True)
class Settings:
    """Runtime settings deliberately limited to the MVP foundation."""

    app_name: str = "TADBIR API"
    api_prefix: str = "/api/v1"
    groq_api_key: str | None = field(default=None, repr=False)
    groq_model: str | None = None
    # Deployed frontend origin(s) allowed by CORS, from FRONTEND_ORIGIN
    # (comma-separated). Local development origins are always allowed.
    frontend_origins: tuple[str, ...] = ()

    @classmethod
    def from_environment(cls, env_file: Path | None = DEFAULT_ENV_FILE) -> "Settings":
        """Load optional LLM configuration without requiring it at startup."""

        file_values = read_env_file(env_file) if env_file is not None else {}

        def setting(name: str) -> str | None:
            return os.getenv(name) or file_values.get(name) or None

        return cls(
            groq_api_key=setting("GROQ_API_KEY"),
            groq_model=setting("GROQ_MODEL"),
            frontend_origins=parse_origins(setting("FRONTEND_ORIGIN")),
        )


LOCAL_DEV_ORIGINS = (
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
)


def parse_origins(value: str | None) -> tuple[str, ...]:
    """Explicit http(s) origins only; a wildcard is never accepted."""

    origins: list[str] = []
    for raw in (value or "").split(","):
        origin = raw.strip().rstrip("/")
        if origin and origin != "*" and origin.startswith(("http://", "https://")):
            origins.append(origin)
    return tuple(origins)


def cors_origins(current: "Settings") -> list[str]:
    return [*LOCAL_DEV_ORIGINS, *(o for o in current.frontend_origins if o not in LOCAL_DEV_ORIGINS)]


settings = Settings.from_environment()
