from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SttModeAvailability:
    enabled: bool
    missing_env: tuple[str, ...] = ()
    unavailable_reason: str | None = None

    def to_public_dict(self) -> dict[str, object]:
        return {
            "enabled": self.enabled,
            "missing_env": list(self.missing_env),
            "missingEnv": list(self.missing_env),
            "unavailable_reason": self.unavailable_reason,
            "unavailableReason": self.unavailable_reason,
        }


@dataclass(frozen=True)
class SttModeConfig:
    name: str
    provider: str
    model: str | None
    language: str | None
    options: dict[str, Any]
    description: str
    experimental: bool = False
    implemented: bool = True
    required_env: tuple[str, ...] = ()

    def to_public_dict(self, availability: SttModeAvailability | None = None) -> dict[str, object]:
        payload: dict[str, object] = {
            "id": self.name,
            "provider": self.provider,
            "model": self.model,
            "language": self.language,
            "options": self.options,
            "description": self.description,
            "experimental": self.experimental,
            "implemented": self.implemented,
            "default": self.name == DEFAULT_STT_MODE,
            "required_env": list(self.required_env),
            "requiredEnv": list(self.required_env),
        }
        if availability is not None:
            payload.update(availability.to_public_dict())
        return payload


DEEPGRAM_COMMON_OPTIONS: dict[str, bool] = {
    "punctuate": True,
    "smart_format": True,
}

GOOGLE_COMMON_OPTIONS: dict[str, object] = {
    "enableAutomaticPunctuation": True,
}

AZURE_COMMON_OPTIONS: dict[str, object] = {
    "format": "detailed",
}

DEFAULT_STT_MODE = "deepgram-ru-nova2"


STT_MODE_CONFIGS: dict[str, SttModeConfig] = {
    "mock": SttModeConfig(
        name="mock",
        provider="mock",
        model=None,
        language=None,
        options={},
        description="Zero-cost text passthrough for local pipeline checks.",
    ),
    "deepgram-multi-nova3": SttModeConfig(
        name="deepgram-multi-nova3",
        provider="deepgram",
        model="nova-3",
        language="multi",
        options=DEEPGRAM_COMMON_OPTIONS,
        description=(
            "Experimental Deepgram nova-3 with language=multi. Kept for RU/KZ code-switching "
            "research; current KZ/MIX results are unusable."
        ),
        experimental=True,
        required_env=("DEEPGRAM_API_KEY",),
    ),
    "deepgram-ru-nova3": SttModeConfig(
        name="deepgram-ru-nova3",
        provider="deepgram",
        model="nova-3",
        language="ru",
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Experimental Russian-only Deepgram nova-3 baseline for Kazakhstan Russian callers.",
        experimental=True,
        required_env=("DEEPGRAM_API_KEY",),
    ),
    "deepgram-ru-nova2": SttModeConfig(
        name="deepgram-ru-nova2",
        provider="deepgram",
        model="nova-2",
        language="ru",
        options=DEEPGRAM_COMMON_OPTIONS,
        description="MVP default / recommended STT mode; Russian-first Deepgram nova-2.",
        required_env=("DEEPGRAM_API_KEY",),
    ),
    "deepgram-default": SttModeConfig(
        name="deepgram-default",
        provider="deepgram",
        model=None,
        language=None,
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Not recommended: Deepgram request with no explicit model or language often returns empty transcripts.",
        experimental=True,
        required_env=("DEEPGRAM_API_KEY",),
    ),
    "google-kk": SttModeConfig(
        name="google-kk",
        provider="google",
        model="speech-to-text-v1p1beta1",
        language="kk-KZ",
        options=GOOGLE_COMMON_OPTIONS,
        description="Experimental Kazakh benchmark mode using Google Speech-to-Text pre-recorded recognize.",
        experimental=True,
        required_env=("GOOGLE_STT_ENABLED", "GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS"),
    ),
    "google-ru": SttModeConfig(
        name="google-ru",
        provider="google",
        model="speech-to-text-v1p1beta1",
        language="ru-RU",
        options=GOOGLE_COMMON_OPTIONS,
        description="Experimental Russian benchmark mode using Google Speech-to-Text pre-recorded recognize.",
        experimental=True,
        required_env=("GOOGLE_STT_ENABLED", "GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS"),
    ),
    "google-ru-kk-auto": SttModeConfig(
        name="google-ru-kk-auto",
        provider="google",
        model="speech-to-text-v1p1beta1",
        language="ru-RU+kk-KZ",
        options={**GOOGLE_COMMON_OPTIONS, "alternativeLanguageCodes": ["kk-KZ"]},
        description=(
            "Experimental Google language-recognition mode with ru-RU primary and kk-KZ as an "
            "alternative language code."
        ),
        experimental=True,
        required_env=("GOOGLE_STT_ENABLED", "GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS"),
    ),
    "azure-kk": SttModeConfig(
        name="azure-kk",
        provider="azure",
        model="speech-to-text-short-audio-rest",
        language="kk-KZ",
        options=AZURE_COMMON_OPTIONS,
        description="Experimental Kazakh benchmark mode using Azure Speech short-audio REST.",
        experimental=True,
        required_env=("AZURE_STT_ENABLED", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"),
    ),
    "azure-ru": SttModeConfig(
        name="azure-ru",
        provider="azure",
        model="speech-to-text-short-audio-rest",
        language="ru-RU",
        options=AZURE_COMMON_OPTIONS,
        description="Experimental Russian benchmark mode using Azure Speech short-audio REST.",
        experimental=True,
        required_env=("AZURE_STT_ENABLED", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"),
    ),
    "azure-ru-kk-auto": SttModeConfig(
        name="azure-ru-kk-auto",
        provider="azure",
        model="speech-sdk-language-identification",
        language="ru-RU+kk-KZ",
        options={"languageIdentification": "at-start", "candidateLanguages": ["ru-RU", "kk-KZ"]},
        description=(
            "Documented placeholder for Azure RU/KZ language identification. The lightweight "
            "short-audio REST path does not implement this yet."
        ),
        experimental=True,
        implemented=False,
        required_env=("AZURE_STT_ENABLED", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"),
    ),
    "whisper-local": SttModeConfig(
        name="whisper-local",
        provider="whisper",
        model="faster-whisper",
        language="kk|ru",
        options={"local": True},
        description=(
            "Documented local Whisper/faster-whisper research mode. Dependency/model install is "
            "intentionally not added to the MVP runtime yet."
        ),
        experimental=True,
        implemented=False,
        required_env=("WHISPER_LOCAL_ENABLED", "faster-whisper model installed"),
    ),
}


STT_MODE_ORDER = [
    "mock",
    "deepgram-ru-nova2",
    "deepgram-ru-nova3",
    "deepgram-multi-nova3",
    "deepgram-default",
    "google-kk",
    "google-ru",
    "google-ru-kk-auto",
    "azure-kk",
    "azure-ru",
    "azure-ru-kk-auto",
    "whisper-local",
]

STT_PROVIDER_ORDER = ["mock", "deepgram", "google", "azure", "whisper"]


def list_stt_mode_configs() -> list[SttModeConfig]:
    return [STT_MODE_CONFIGS[name] for name in STT_MODE_ORDER]


def get_stt_mode_config(name: str) -> SttModeConfig:
    normalized = name.strip().lower()
    if normalized not in STT_MODE_CONFIGS:
        raise KeyError(normalized)

    return STT_MODE_CONFIGS[normalized]


def stt_mode_availability(mode_config: SttModeConfig, settings: object) -> SttModeAvailability:
    if mode_config.provider == "mock":
        return SttModeAvailability(enabled=True)

    if not mode_config.implemented:
        return SttModeAvailability(
            enabled=False,
            missing_env=mode_config.required_env,
            unavailable_reason=f"{mode_config.name} is a documented skeleton mode and is not implemented yet.",
        )

    if mode_config.provider == "deepgram":
        if getattr(settings, "deepgram_api_key", None):
            return SttModeAvailability(enabled=True)
        return SttModeAvailability(
            enabled=False,
            missing_env=("DEEPGRAM_API_KEY",),
            unavailable_reason="Deepgram mode is disabled until DEEPGRAM_API_KEY is configured.",
        )

    if mode_config.provider == "google":
        missing_env: list[str] = []
        if not getattr(settings, "google_stt_enabled", False):
            missing_env.append("GOOGLE_STT_ENABLED")
        if not (
            getattr(settings, "google_stt_api_key", None)
            or getattr(settings, "google_application_credentials", None)
        ):
            missing_env.append("GOOGLE_STT_API_KEY or GOOGLE_APPLICATION_CREDENTIALS")
        if missing_env:
            return SttModeAvailability(
                enabled=False,
                missing_env=tuple(missing_env),
                unavailable_reason="Google STT benchmark modes are opt-in and require Google credentials.",
            )
        return SttModeAvailability(enabled=True)

    if mode_config.provider == "azure":
        missing_env: list[str] = []
        if not getattr(settings, "azure_stt_enabled", False):
            missing_env.append("AZURE_STT_ENABLED")
        if not getattr(settings, "azure_speech_key", None):
            missing_env.append("AZURE_SPEECH_KEY")
        if not getattr(settings, "azure_speech_region", None):
            missing_env.append("AZURE_SPEECH_REGION")
        if missing_env:
            return SttModeAvailability(
                enabled=False,
                missing_env=tuple(missing_env),
                unavailable_reason="Azure STT benchmark modes are opt-in and require Azure Speech credentials.",
            )
        return SttModeAvailability(enabled=True)

    return SttModeAvailability(
        enabled=False,
        missing_env=mode_config.required_env,
        unavailable_reason=f"Unsupported STT provider: {mode_config.provider}.",
    )


def list_public_stt_modes(settings: object) -> list[dict[str, object]]:
    return [
        mode.to_public_dict(stt_mode_availability(mode, settings))
        for mode in list_stt_mode_configs()
    ]
