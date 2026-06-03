import base64
import json
from dataclasses import dataclass, field
from typing import Any
from urllib import error, parse, request

from .config import Settings
from .stt_modes import (
    DEFAULT_STT_MODE,
    DEEPGRAM_COMMON_OPTIONS,
    STT_MODE_CONFIGS,
    SttModeConfig,
    stt_mode_availability,
)


class SttError(RuntimeError):
    pass


class SttProviderUnavailable(SttError):
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
            raise SttProviderUnavailable("Deepgram STT requires DEEPGRAM_API_KEY.")

        self._settings = settings
        self._mode_config = mode_config

    def transcribe_audio(self, audio: bytes, content_type: str | None) -> SttResult:
        _require_audio(audio, "Deepgram")

        response = self._post_to_deepgram(audio, content_type or "application/octet-stream")
        transcript = _extract_deepgram_transcript(response)

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
            safe_body = _safe_http_error_body(exc)
            raise SttError(f"Deepgram STT failed with HTTP {exc.code}: {safe_body}") from exc
        except error.URLError as exc:
            raise SttError(f"Deepgram STT request failed: {exc.reason}") from exc

        return _parse_object_response(body, "Deepgram")


class GoogleSttProvider:
    name = "google"
    endpoint = "https://speech.googleapis.com/v1p1beta1/speech:recognize"

    def __init__(self, settings: Settings, mode_config: SttModeConfig):
        availability = stt_mode_availability(mode_config, settings)
        if not availability.enabled:
            raise SttProviderUnavailable(availability.unavailable_reason or "Google STT mode is disabled.")

        self._settings = settings
        self._mode_config = mode_config

    def transcribe_audio(self, audio: bytes, content_type: str | None) -> SttResult:
        _require_audio(audio, "Google")

        response = self._post_to_google(audio, content_type or "application/octet-stream")
        transcript = _extract_google_transcript(response)

        return SttResult(
            provider=self.name,
            transcript=transcript,
            mode=self._mode_config.name,
            mode_config=self._mode_config.to_public_dict(),
            raw=_safe_google_metadata(response),
        )

    def _post_to_google(self, audio: bytes, content_type: str) -> dict[str, Any]:
        headers = {"Content-Type": "application/json; charset=utf-8"}
        endpoint = self.endpoint
        if self._settings.google_stt_api_key:
            endpoint = f"{endpoint}?{parse.urlencode({'key': self._settings.google_stt_api_key})}"
        else:
            headers["Authorization"] = f"Bearer {_google_bearer_token(self._settings)}"

        payload = {
            "config": _google_recognition_config(self._mode_config, content_type),
            "audio": {"content": base64.b64encode(audio).decode("ascii")},
        }
        google_request = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(google_request, timeout=45) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            safe_body = _safe_http_error_body(exc)
            raise SttError(f"Google STT failed with HTTP {exc.code}: {safe_body}") from exc
        except error.URLError as exc:
            raise SttError(f"Google STT request failed: {exc.reason}") from exc

        return _parse_object_response(body, "Google")


class AzureSttProvider:
    name = "azure"

    def __init__(self, settings: Settings, mode_config: SttModeConfig):
        availability = stt_mode_availability(mode_config, settings)
        if not availability.enabled:
            raise SttProviderUnavailable(availability.unavailable_reason or "Azure STT mode is disabled.")

        self._settings = settings
        self._mode_config = mode_config

    def transcribe_audio(self, audio: bytes, content_type: str | None) -> SttResult:
        _require_audio(audio, "Azure")
        if not self._mode_config.language:
            raise SttProviderUnavailable(f"Azure mode {self._mode_config.name} has no language configured.")

        azure_content_type = _azure_content_type(content_type)
        response = self._post_to_azure(audio, azure_content_type)
        transcript = _extract_azure_transcript(response)

        return SttResult(
            provider=self.name,
            transcript=transcript,
            mode=self._mode_config.name,
            mode_config=self._mode_config.to_public_dict(),
            raw=_safe_azure_metadata(response),
        )

    def _post_to_azure(self, audio: bytes, content_type: str) -> dict[str, Any]:
        assert self._settings.azure_speech_key
        assert self._settings.azure_speech_region
        assert self._mode_config.language

        query = {"language": self._mode_config.language, "format": "detailed"}
        url = (
            f"https://{self._settings.azure_speech_region}.stt.speech.microsoft.com"
            f"/speech/recognition/conversation/cognitiveservices/v1?{parse.urlencode(query)}"
        )
        headers = {
            "Accept": "application/json",
            "Content-Type": content_type,
            "Ocp-Apim-Subscription-Key": self._settings.azure_speech_key,
        }
        azure_request = request.Request(url, data=audio, headers=headers, method="POST")

        try:
            with request.urlopen(azure_request, timeout=45) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            safe_body = _safe_http_error_body(exc)
            raise SttError(f"Azure STT failed with HTTP {exc.code}: {safe_body}") from exc
        except error.URLError as exc:
            raise SttError(f"Azure STT request failed: {exc.reason}") from exc

        return _parse_object_response(body, "Azure")


class WhisperLocalSttProvider:
    name = "whisper"

    def __init__(self, settings: Settings, mode_config: SttModeConfig):
        availability = stt_mode_availability(mode_config, settings)
        raise SttProviderUnavailable(
            availability.unavailable_reason
            or "whisper-local is a documented research mode; install and wire faster-whisper before use."
        )


def _require_audio(audio: bytes, provider_label: str) -> None:
    if not audio:
        raise SttError(f"{provider_label} STT requires a non-empty audio file.")


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


def _google_recognition_config(mode_config: SttModeConfig, content_type: str) -> dict[str, object]:
    language_code = _primary_language(mode_config.language)
    config: dict[str, object] = {
        "languageCode": language_code,
        "enableAutomaticPunctuation": True,
    }
    encoding = _google_audio_encoding(content_type)
    if encoding:
        config["encoding"] = encoding

    alternative_language_codes = mode_config.options.get("alternativeLanguageCodes")
    if isinstance(alternative_language_codes, list) and alternative_language_codes:
        config["alternativeLanguageCodes"] = alternative_language_codes

    return config


def _primary_language(language: str | None) -> str:
    if not language:
        return "ru-RU"
    return language.split("+", maxsplit=1)[0]


def _google_audio_encoding(content_type: str) -> str | None:
    lowered = content_type.casefold()
    if "webm" in lowered:
        return "WEBM_OPUS"
    if "ogg" in lowered or "opus" in lowered:
        return "OGG_OPUS"
    if "mpeg" in lowered or "mp3" in lowered:
        return "MP3"
    if "wav" in lowered or "wave" in lowered or "linear16" in lowered or "pcm" in lowered:
        return "LINEAR16"
    return None


def _azure_content_type(content_type: str | None) -> str:
    lowered = (content_type or "").casefold()
    if "ogg" in lowered or "opus" in lowered:
        return "audio/ogg; codecs=opus"
    if "wav" in lowered or "wave" in lowered or "pcm" in lowered:
        return "audio/wav; codecs=audio/pcm; samplerate=16000"

    raise SttError(
        "Azure short-audio REST supports WAV PCM or OGG OPUS uploads. "
        "Use a .wav/.ogg file for Azure benchmark modes."
    )


def _extract_deepgram_transcript(response: dict[str, Any]) -> str:
    channels = response.get("results", {}).get("channels", [])
    if not channels:
        return ""

    alternatives = channels[0].get("alternatives", [])
    if not alternatives:
        return ""

    transcript = alternatives[0].get("transcript", "")
    return transcript.strip() if isinstance(transcript, str) else ""


def _extract_google_transcript(response: dict[str, Any]) -> str:
    results = response.get("results", [])
    if not isinstance(results, list):
        return ""

    transcript_parts: list[str] = []
    for result in results:
        if not isinstance(result, dict):
            continue
        alternatives = result.get("alternatives", [])
        if not alternatives or not isinstance(alternatives, list):
            continue
        first_alternative = alternatives[0]
        if not isinstance(first_alternative, dict):
            continue
        transcript = first_alternative.get("transcript", "")
        if isinstance(transcript, str) and transcript.strip():
            transcript_parts.append(transcript.strip())

    return " ".join(transcript_parts).strip()


def _extract_azure_transcript(response: dict[str, Any]) -> str:
    display_text = response.get("DisplayText")
    if isinstance(display_text, str) and display_text.strip():
        return display_text.strip()

    nbest = response.get("NBest")
    if isinstance(nbest, list) and nbest:
        first = nbest[0]
        if isinstance(first, dict):
            display = first.get("Display")
            if isinstance(display, str):
                return display.strip()
            lexical = first.get("Lexical")
            if isinstance(lexical, str):
                return lexical.strip()

    return ""


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


def _safe_google_metadata(response: dict[str, Any]) -> dict[str, object]:
    results = response.get("results", [])
    raw: dict[str, object] = {"result_count": len(results) if isinstance(results, list) else 0}
    if not isinstance(results, list) or not results:
        return raw

    first_result = results[0]
    if isinstance(first_result, dict):
        language_code = first_result.get("languageCode")
        if language_code is not None:
            raw["languageCode"] = language_code
        alternatives = first_result.get("alternatives", [])
        if isinstance(alternatives, list) and alternatives:
            first_alternative = alternatives[0]
            if isinstance(first_alternative, dict):
                confidence = first_alternative.get("confidence")
                if confidence is not None:
                    raw["confidence"] = confidence

    total_billed_time = response.get("totalBilledTime")
    if total_billed_time is not None:
        raw["totalBilledTime"] = total_billed_time

    return raw


def _safe_azure_metadata(response: dict[str, Any]) -> dict[str, object]:
    raw: dict[str, object] = {}
    for key in ["RecognitionStatus", "Offset", "Duration"]:
        value = response.get(key)
        if value is not None:
            raw[key] = value

    nbest = response.get("NBest")
    if isinstance(nbest, list) and nbest:
        first = nbest[0]
        if isinstance(first, dict):
            for key in ["Confidence", "ITN", "MaskedITN"]:
                value = first.get(key)
                if value is not None:
                    raw[key] = value

    return raw


def _google_bearer_token(settings: Settings) -> str:
    if not settings.google_application_credentials:
        raise SttProviderUnavailable("Google STT requires GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.")

    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import service_account
    except ImportError as exc:
        raise SttProviderUnavailable(
            "GOOGLE_APPLICATION_CREDENTIALS requires the optional google-auth package. "
            "Install it in services/voice-agent or use GOOGLE_STT_API_KEY."
        ) from exc

    credentials = service_account.Credentials.from_service_account_file(
        settings.google_application_credentials,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    credentials.refresh(GoogleAuthRequest())
    token = credentials.token
    if not token:
        raise SttProviderUnavailable("Google application credentials did not return an access token.")

    return str(token)


def _safe_http_error_body(exc: error.HTTPError) -> str:
    return exc.read().decode("utf-8", errors="replace")[:300]


def _parse_object_response(body: str, provider_label: str) -> dict[str, Any]:
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise SttError(f"{provider_label} returned a non-object response.")

    return parsed


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

    if mode_config.provider == "google":
        return GoogleSttProvider(settings, mode_config).transcribe_audio(audio or b"", content_type)

    if mode_config.provider == "azure":
        return AzureSttProvider(settings, mode_config).transcribe_audio(audio or b"", content_type)

    if mode_config.provider == "whisper":
        return WhisperLocalSttProvider(settings, mode_config).transcribe_audio(audio or b"", content_type)

    raise SttError(f"Unsupported STT provider for mode {mode_config.name}: {mode_config.provider}")
