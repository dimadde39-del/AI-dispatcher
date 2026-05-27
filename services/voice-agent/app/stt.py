import json
from dataclasses import dataclass, field
from typing import Any
from urllib import error, parse, request

from .config import Settings
from .stt_modes import DEFAULT_STT_MODE, DEEPGRAM_COMMON_OPTIONS, STT_MODE_CONFIGS, SttModeConfig


class SttError(RuntimeError):
    pass


@dataclass(frozen=True)
class SttResult:
    provider: str
    transcript: str
    mode: str = "unknown"
    mode_config: dict[str, object] = field(default_factory=dict)
    raw: dict[str, object] = field(default_factory=dict)


class MockSttProvider:
    name = "mock"

    def __init__(self, mode_config: SttModeConfig | None = None):
        self._mode_config = mode_config or STT_MODE_CONFIGS["mock"]

    def transcribe_text(self, text: str | None) -> SttResult:
        transcript = (text or "").strip()
        if not transcript:
            raise SttError("Mock STT requires a non-empty text field.")

        return SttResult(
            provider=self.name,
            transcript=transcript,
            mode=self._mode_config.name,
            mode_config=self._mode_config.to_public_dict(),
            raw={"mode": "text"},
        )


class DeepgramSttProvider:
    name = "deepgram"

    def __init__(self, settings: Settings, mode_config: SttModeConfig):
        if not settings.deepgram_api_key:
            raise SttError("Deepgram STT requires DEEPGRAM_API_KEY.")

        self._settings = settings
        self._mode_config = mode_config

    def transcribe_audio(self, audio: bytes, content_type: str | None) -> SttResult:
        if not audio:
            raise SttError("Deepgram STT requires a non-empty audio file.")

        response = self._post_to_deepgram(audio, content_type or "application/octet-stream")
        transcript = _extract_transcript(response)

        return SttResult(
            provider=self.name,
            transcript=transcript,
            mode=self._mode_config.name,
            mode_config=self._mode_config.to_public_dict(),
            raw=_safe_deepgram_metadata(response),
        )

    def _post_to_deepgram(self, audio: bytes, content_type: str) -> dict[str, Any]:
        query = _deepgram_query(self._mode_config)
        url = f"https://api.deepgram.com/v1/listen?{parse.urlencode(query)}"
        headers = {
            "Authorization": f"Token {self._settings.deepgram_api_key}",
            "Content-Type": content_type,
        }
        deepgram_request = request.Request(url, data=audio, headers=headers, method="POST")

        try:
            with request.urlopen(deepgram_request, timeout=30) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            safe_body = exc.read().decode("utf-8", errors="replace")[:300]
            raise SttError(f"Deepgram STT failed with HTTP {exc.code}: {safe_body}") from exc
        except error.URLError as exc:
            raise SttError(f"Deepgram STT request failed: {exc.reason}") from exc

        parsed = json.loads(body)
        if not isinstance(parsed, dict):
            raise SttError("Deepgram returned a non-object response.")

        return parsed


def _deepgram_language(language_mode: str) -> str:
    if language_mode in {"ru", "ru-only"}:
        return "ru"

    if language_mode in {"multi", "ru-kk", "ru-kz", "kk", "kz"}:
        return "multi"

    return language_mode


def _deepgram_query(mode_config: SttModeConfig) -> dict[str, str]:
    query: dict[str, str] = {}
    if mode_config.model:
        query["model"] = mode_config.model
    if mode_config.language:
        query["language"] = mode_config.language

    for key, value in mode_config.options.items():
        if isinstance(value, bool):
            query[key] = "true" if value else "false"
        else:
            query[key] = str(value)

    return query


def _extract_transcript(response: dict[str, Any]) -> str:
    channels = response.get("results", {}).get("channels", [])
    if not channels:
        return ""

    alternatives = channels[0].get("alternatives", [])
    if not alternatives:
        return ""

    transcript = alternatives[0].get("transcript", "")
    return transcript.strip() if isinstance(transcript, str) else ""


def _safe_deepgram_metadata(response: dict[str, Any]) -> dict[str, object]:
    metadata = response.get("metadata", {})
    channels = response.get("results", {}).get("channels", [])
    first_alternative = {}
    if channels:
        alternatives = channels[0].get("alternatives", [])
        if alternatives:
            first_alternative = alternatives[0]

    raw: dict[str, object] = {}
    if isinstance(metadata, dict):
        for key in ["request_id", "duration", "channels", "models", "model_info"]:
            value = metadata.get(key)
            if value is not None:
                raw[key] = value

    if isinstance(first_alternative, dict):
        for key in ["confidence", "languages"]:
            value = first_alternative.get(key)
            if value is not None:
                raw[key] = value

    return raw


def _legacy_deepgram_config(settings: Settings) -> SttModeConfig:
    return SttModeConfig(
        name="deepgram-legacy",
        provider="deepgram",
        model=settings.deepgram_model,
        language=_deepgram_language(settings.stt_language_mode),
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Legacy STT_PROVIDER=deepgram config from DEEPGRAM_MODEL and STT_LANGUAGE_MODE.",
    )


def _resolve_mode_config(settings: Settings, selector_name: str | None) -> SttModeConfig:
    selector = (selector_name or settings.stt_mode or settings.stt_provider or DEFAULT_STT_MODE).strip().lower()
    if selector in STT_MODE_CONFIGS:
        return STT_MODE_CONFIGS[selector]

    if selector == "deepgram":
        return _legacy_deepgram_config(settings)

    raise SttError(f"Unsupported STT mode or provider: {selector}")


def transcribe_with_provider(
    settings: Settings,
    provider_name: str | None,
    mode_name: str | None = None,
    text: str | None = None,
    audio: bytes | None = None,
    content_type: str | None = None,
) -> SttResult:
    mode_config = _resolve_mode_config(settings, mode_name or provider_name)
    if mode_config.provider == "mock":
        return MockSttProvider(mode_config).transcribe_text(text)

    if mode_config.provider == "deepgram":
        return DeepgramSttProvider(settings, mode_config).transcribe_audio(audio or b"", content_type)

    raise SttError(f"Unsupported STT provider for mode {mode_config.name}: {mode_config.provider}")
