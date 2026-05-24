import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    backend_base_url: str = "http://localhost:3000"
    self_host_voice_webhook_secret: str | None = None
    deepgram_api_key: str | None = None
    stt_provider: str = "mock"
    stt_language_mode: str = "ru-kk"
    deepgram_model: str = "nova-3"
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    tts_provider_api_key: str | None = None


def _optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None


def load_settings() -> Settings:
    return Settings(
        backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:3000").rstrip("/"),
        self_host_voice_webhook_secret=_optional_env("SELF_HOST_VOICE_WEBHOOK_SECRET"),
        deepgram_api_key=_optional_env("DEEPGRAM_API_KEY"),
        stt_provider=os.getenv("STT_PROVIDER", "mock").strip().lower() or "mock",
        stt_language_mode=os.getenv("STT_LANGUAGE_MODE", "ru-kk").strip().lower() or "ru-kk",
        deepgram_model=os.getenv("DEEPGRAM_MODEL", "nova-3").strip() or "nova-3",
        openai_api_key=_optional_env("OPENAI_API_KEY"),
        deepseek_api_key=_optional_env("DEEPSEEK_API_KEY"),
        tts_provider_api_key=_optional_env("TTS_PROVIDER_API_KEY"),
    )
