import json
from dataclasses import dataclass, field
from typing import Any
from urllib import error, parse, request

from .config import Settings


class SttError(RuntimeError):
    pass


@dataclass(frozen=True)
class SttResult:
    provider: str
    transcript: str
    raw: dict[str, object] = field(default_factory=dict)


class MockSttProvider:
    name = "mock"

    def transcribe_text(self, text: str | None) -> SttResult:
        transcript = (text or "").strip()
        if not transcript:
            raise SttError("Mock STT requires a non-empty text field.")

        return SttResult(
            provider=self.name,
            transcript=transcript,
            raw={"mode": "text"},
        )


class DeepgramSttProvider:
    name = "deepgram"

    def __init__(self, settings: Settings):
        if not settings.deepgram_api_key:
            raise SttError("Deepgram STT requires DEEPGRAM_API_KEY.")

        self._settings = settings

    def transcribe_audio(self, audio: bytes, content_type: str | None) -> SttResult:
        if not audio:
            raise SttError("Deepgram STT requires a non-empty audio file.")

        response = self._post_to_deepgram(audio, content_type or "application/octet-stream")
        transcript = _extract_transcript(response)
        if not transcript:
            raise SttError("Deepgram returned an empty transcript.")

        return SttResult(
            provider=self.name,
            transcript=transcript,
            raw=_safe_deepgram_metadata(response),
        )

    def _post_to_deepgram(self, audio: bytes, content_type: str) -> dict[str, Any]:
        query = {
            "model": self._settings.deepgram_model,
            "language": _deepgram_language(self._settings.stt_language_mode),
            "punctuate": "true",
            "smart_format": "true",
        }
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


def transcribe_with_provider(
    settings: Settings,
    provider_name: str | None,
    text: str | None = None,
    audio: bytes | None = None,
    content_type: str | None = None,
) -> SttResult:
    provider = (provider_name or settings.stt_provider).strip().lower()
    if provider == "mock":
        return MockSttProvider().transcribe_text(text)

    if provider == "deepgram":
        return DeepgramSttProvider(settings).transcribe_audio(audio or b"", content_type)

    raise SttError(f"Unsupported STT provider: {provider}")
