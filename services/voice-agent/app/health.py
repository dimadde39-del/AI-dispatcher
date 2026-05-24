from .config import Settings


def allowed_origins(settings: Settings) -> list[str]:
    origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.backend_base_url,
    }
    return sorted(origin for origin in origins if origin)


def build_health_response(settings: Settings) -> dict[str, object]:
    return {
        "ok": True,
        "service": "voice-agent",
        "sttProvider": settings.stt_provider,
        "sttMode": settings.stt_mode or settings.stt_provider,
        "sttLanguageMode": settings.stt_language_mode,
        "backendBaseUrl": settings.backend_base_url,
        "deepgramConfigured": bool(settings.deepgram_api_key),
        "productionReady": False,
    }
