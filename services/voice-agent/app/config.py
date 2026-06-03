import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    backend_base_url: str = "http://localhost:3000"
    self_host_voice_webhook_secret: str | None = None
    deepgram_api_key: str | None = None
    google_stt_enabled: bool = False
    google_stt_api_key: str | None = None
    google_application_credentials: str | None = None
    azure_stt_enabled: bool = False
    azure_speech_key: str | None = None
    azure_speech_region: str | None = None
    whisper_local_enabled: bool = False
    stt_provider: str = "mock"
    stt_mode: str | None = "deepgram-ru-nova2"
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


def _bool_env(name: str, default: bool = False) -> bool:
    value = _optional_env(name)
    if value is None:
        return default

    return value.casefold() in {"1", "true", "yes", "on"}


def load_settings() -> Settings:
    return Settings(
        backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:3000").rstrip("/"),
        self_host_voice_webhook_secret=_optional_env("SELF_HOST_VOICE_WEBHOOK_SECRET"),
        deepgram_api_key=_optional_env("DEEPGRAM_API_KEY"),
        google_stt_enabled=_bool_env("GOOGLE_STT_ENABLED", False),
        google_stt_api_key=_optional_env("GOOGLE_STT_API_KEY"),
        google_application_credentials=_optional_env("GOOGLE_APPLICATION_CREDENTIALS"),
        azure_stt_enabled=_bool_env("AZURE_STT_ENABLED", False),
        azure_speech_key=_optional_env("AZURE_SPEECH_KEY"),
        azure_speech_region=_optional_env("AZURE_SPEECH_REGION"),
        whisper_local_enabled=_bool_env("WHISPER_LOCAL_ENABLED", False),
        stt_provider=os.getenv("STT_PROVIDER", "mock").strip().lower() or "mock",
        stt_mode=_optional_env("STT_MODE") or "deepgram-ru-nova2",
        stt_language_mode=os.getenv("STT_LANGUAGE_MODE", "ru-kk").strip().lower() or "ru-kk",
        deepgram_model=os.getenv("DEEPGRAM_MODEL", "nova-3").strip() or "nova-3",
        openai_api_key=_optional_env("OPENAI_API_KEY"),
        deepseek_api_key=_optional_env("DEEPSEEK_API_KEY"),
        tts_provider_api_key=_optional_env("TTS_PROVIDER_API_KEY"),
    )
