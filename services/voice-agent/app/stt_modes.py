from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SttModeConfig:
    name: str
    provider: str
    model: str | None
    language: str | None
    options: dict[str, Any]
    description: str

    def to_public_dict(self) -> dict[str, object]:
        return {
            "id": self.name,
            "provider": self.provider,
            "model": self.model,
            "language": self.language,
            "options": self.options,
            "description": self.description,
        }


DEEPGRAM_COMMON_OPTIONS: dict[str, bool] = {
    "punctuate": True,
    "smart_format": True,
}


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
            "Assumes Deepgram nova-3 with language=multi is the current best candidate "
            "for RU/KZ code-switching experiments."
        ),
    ),
    "deepgram-ru-nova3": SttModeConfig(
        name="deepgram-ru-nova3",
        provider="deepgram",
        model="nova-3",
        language="ru",
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Russian-only Deepgram nova-3 baseline for Kazakhstan Russian callers.",
    ),
    "deepgram-ru-nova2": SttModeConfig(
        name="deepgram-ru-nova2",
        provider="deepgram",
        model="nova-2",
        language="ru",
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Russian-only Deepgram nova-2 baseline to compare against nova-3.",
    ),
    "deepgram-default": SttModeConfig(
        name="deepgram-default",
        provider="deepgram",
        model=None,
        language=None,
        options=DEEPGRAM_COMMON_OPTIONS,
        description="Deepgram request with no explicit model or language; API defaults are used.",
    ),
}


STT_MODE_ORDER = [
    "mock",
    "deepgram-multi-nova3",
    "deepgram-ru-nova3",
    "deepgram-ru-nova2",
    "deepgram-default",
]


def list_stt_mode_configs() -> list[SttModeConfig]:
    return [STT_MODE_CONFIGS[name] for name in STT_MODE_ORDER]


def get_stt_mode_config(name: str) -> SttModeConfig:
    normalized = name.strip().lower()
    if normalized not in STT_MODE_CONFIGS:
        raise KeyError(normalized)

    return STT_MODE_CONFIGS[normalized]
