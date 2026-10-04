from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.services.groq import GroqConfigurationError, GroqService, LLMMessage


def test_groq_configuration_reads_environment_without_exposing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-secret-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    settings = Settings.from_environment()

    assert settings.groq_api_key == "test-secret-key"
    assert settings.groq_model == "test-model"
    assert "test-secret-key" not in repr(settings)


def test_settings_read_env_file_with_spacing_and_quotes(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_MODEL", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text('# comment\r\nGROQ_API_KEY= file-secret \r\nGROQ_MODEL="file-model"\r\n', encoding="utf-8")

    settings = Settings.from_environment(env_file)

    assert settings.groq_api_key == "file-secret"
    assert settings.groq_model == "file-model"
    assert "file-secret" not in repr(settings)


def test_environment_variables_override_env_file(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_MODEL", "env-model")
    env_file = tmp_path / ".env"
    env_file.write_text("GROQ_MODEL=file-model\n", encoding="utf-8")

    assert Settings.from_environment(env_file).groq_model == "env-model"


def test_frontend_origin_is_added_to_cors_without_wildcards(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import LOCAL_DEV_ORIGINS, cors_origins

    monkeypatch.setenv("FRONTEND_ORIGIN", " https://fluxscope.example.com/ , * ,not-a-url, https://b.example.com")
    settings = Settings.from_environment(tmp_path / "absent.env")

    assert settings.frontend_origins == ("https://fluxscope.example.com", "https://b.example.com")
    origins = cors_origins(settings)
    assert origins[: len(LOCAL_DEV_ORIGINS)] == list(LOCAL_DEV_ORIGINS)
    assert "https://fluxscope.example.com" in origins
    assert "*" not in origins


def test_cors_defaults_to_local_development_only(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import LOCAL_DEV_ORIGINS, cors_origins

    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    assert cors_origins(Settings.from_environment(tmp_path / "absent.env")) == list(LOCAL_DEV_ORIGINS)


def test_local_frontend_preflight_is_still_allowed() -> None:
    response = TestClient(app).options(
        "/api/v1/detect",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_missing_env_file_is_not_an_error(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    settings = Settings.from_environment(tmp_path / "absent.env")
    assert settings.groq_api_key is None


def test_missing_groq_key_fails_only_when_operation_is_invoked() -> None:
    service = GroqService(Settings(groq_model="test-model"))
    assert service.is_configured is False

    with pytest.raises(GroqConfigurationError, match="GROQ_API_KEY is not configured"):
        service.complete([LLMMessage(role="user", content="test")])


def test_groq_service_is_testable_without_network() -> None:
    calls: list[tuple[str, list[dict[str, str]]]] = []

    class FakeCompletions:
        def create(self, *, model: str, messages: list[dict[str, str]]) -> object:
            calls.append((model, messages))
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="test response"))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    service = GroqService(Settings(groq_api_key="test-secret-key", groq_model="test-model"), lambda _: fake_client)

    assert service.complete([LLMMessage(role="user", content="test")]) == "test response"
    assert calls == [("test-model", [{"role": "user", "content": "test"}])]


def test_api_response_never_exposes_environment_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-secret-key")
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert "test-secret-key" not in response.text
