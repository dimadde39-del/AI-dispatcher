from fastapi import FastAPI

from .config import load_settings

app = FastAPI(title="AI Dispatcher Self-Host Voice Agent Spike")


@app.get("/health")
def health() -> dict[str, object]:
    settings = load_settings()
    return {
        "ok": True,
        "service": "voice-agent",
        "backendBaseUrlConfigured": bool(settings.backend_base_url),
        "webhookSecretConfigured": bool(settings.self_host_voice_webhook_secret),
        "productionReady": False,
    }
