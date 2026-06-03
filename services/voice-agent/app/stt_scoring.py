from dataclasses import dataclass
import re
from typing import Literal

from .stt_scenarios import SttScenario


KAZAKH_CHAR_PATTERN = re.compile(r"[әғқңөұүһіӘҒҚҢӨҰҮҺІ]")
RUSSIAN_CHAR_PATTERN = re.compile(r"[а-яёА-ЯЁ]")
CYRILLIC_CHAR_PATTERN = re.compile(r"[а-яёәғқңөұүһіА-ЯЁӘҒҚҢӨҰҮҺІ]")
SPANISH_OR_ENGLISH_JUNK = (
    "hola",
    "buenos",
    "gracias",
    "senor",
    "señor",
    "hello",
    "thank you",
    "thanks",
    "water leak",
    "plumber",
    "address",
    "my name is",
    "bathroom",
)
LATINIZED_KAZAKH_MARKERS = (
    "aga",
    "agha",
    "agyp",
    "agip",
    "jatyr",
    "zhatyr",
    "ketip",
    "tezirek",
    "keliniz",
    "shymkent",
    "shimkent",
    "nursat",
    "turan",
    "su",
)
KEYWORD_ALIASES: dict[str, tuple[str, ...]] = {
    "шымкент": ("шемкент", "шимкент", "shymkent", "shimkent"),
    "нурсат": ("нұрсат", "nursat", "норсад", "наш сад"),
    "нұрсат": ("нурсат", "nursat", "норсад", "наш сад"),
    "тұран": ("туран", "turan"),
    "туран": ("тұран", "turan"),
    "су": ("вода", "воды", "водичка", "суы", "su"),
    "ағып жатыр": ("агып жатыр", "кетіп жатыр", "кетип жатыр", "ағып тұр", "агып тур", "течет", "течь"),
    "ағып": ("агып", "кетіп", "кетип", "течет", "течь"),
    "жатыр": ("тұр", "тур", "идет"),
    "кетіп жатыр": ("ағып жатыр", "агып жатыр", "кетип жатыр", "ағып тұр", "течет", "течь"),
    "кран": ("крана", "краннан", "құбыр", "кубыр", "труба", "смеситель", "kran"),
    "құбыр": ("кубыр", "кран", "труба"),
    "труба": ("трубы", "кран", "құбыр", "кубыр"),
    "течет": ("течёт", "течь", "ағып жатыр", "агып жатыр"),
    "течь": ("течет", "течёт", "ағып жатыр", "агып жатыр"),
    "тезірек": ("тезирек", "тез", "срочно", "быстро", "tezirek", "tez"),
    "он бес": ("15", "пятнадцать"),
    "он бесінші": ("15", "пятнадцатый", "он бес"),
    "иісі": ("исі", "иісі бар", "запах", "пахнет"),
    "газ": ("газом", "газа"),
}
SAFETY_SCENARIO_IDS = {"gas-emergency", "gas-kz-ru", "electric-danger"}
SttConfidence = Literal["high", "medium", "low", "unusable"]


@dataclass(frozen=True)
class SttScore:
    keyword_hits: list[str]
    missed_keywords: list[str]
    has_russian: bool
    has_kazakh_chars: bool
    likely_wrong_language: bool
    score: int
    warnings: list[str]
    confidence: SttConfidence
    usable: bool
    requires_callback: bool
    has_latinized_kazakh: bool = False
    cyrillic_ratio: float = 0

    def to_public_dict(self) -> dict[str, object]:
        return {
            "keyword_hits": self.keyword_hits,
            "keywordHits": self.keyword_hits,
            "missed_keywords": self.missed_keywords,
            "missedKeywords": self.missed_keywords,
            "has_russian": self.has_russian,
            "has_kazakh_chars": self.has_kazakh_chars,
            "has_latinized_kazakh": self.has_latinized_kazakh,
            "hasLatinizedKazakh": self.has_latinized_kazakh,
            "cyrillic_ratio": self.cyrillic_ratio,
            "cyrillicRatio": self.cyrillic_ratio,
            "likely_wrong_language": self.likely_wrong_language,
            "score": self.score,
            "warnings": self.warnings,
            "confidence": self.confidence,
            "usable": self.usable,
            "requiresCallback": self.requires_callback,
        }


def score_transcript(transcript: str, scenario: SttScenario) -> SttScore:
    if not transcript.strip():
        return SttScore(
            keyword_hits=[],
            missed_keywords=list(scenario.expected_keywords),
            has_russian=False,
            has_kazakh_chars=False,
            likely_wrong_language=False,
            score=0,
            warnings=["empty_transcript", "low_confidence"],
            confidence="unusable",
            usable=False,
            requires_callback=True,
        )

    normalized_transcript = _normalize(transcript)
    keyword_hits: list[str] = []
    missed_keywords: list[str] = []

    for keyword in scenario.expected_keywords:
        if _keyword_matches(normalized_transcript, keyword):
            keyword_hits.append(keyword)
        else:
            missed_keywords.append(keyword)

    has_russian = bool(RUSSIAN_CHAR_PATTERN.search(transcript))
    has_kazakh_chars = bool(KAZAKH_CHAR_PATTERN.search(transcript))
    cyrillic_ratio = _cyrillic_ratio(transcript)
    has_latinized_kazakh = _looks_latinized_kazakh(normalized_transcript)
    mostly_non_cyrillic_kz = scenario.expected_language in {"kk", "mixed"} and cyrillic_ratio < 0.5
    likely_wrong_language = _looks_like_wrong_language(normalized_transcript, scenario.expected_language)
    keyword_score = _keyword_score(keyword_hits, scenario.expected_keywords)
    language_score = _language_score(scenario.expected_language, has_russian, has_kazakh_chars)
    score = max(0, min(100, keyword_score + language_score))

    warnings: list[str] = []
    if missed_keywords:
        warnings.append("missed_keywords")
    if likely_wrong_language:
        warnings.append("likely_wrong_language")
        score = max(0, score - 40)
    if scenario.expected_language in {"kk", "mixed"} and has_latinized_kazakh:
        warnings.append("latinized_kazakh_detected")
    if mostly_non_cyrillic_kz:
        warnings.append("mostly_non_cyrillic_kz")
        score = max(0, score - 15)
    if not has_russian and not has_kazakh_chars:
        warnings.append("no_cyrillic_detected")
    if scenario.expected_language == "kk" and not has_kazakh_chars:
        warnings.append("kazakh_chars_missing")
    if scenario.expected_language == "mixed" and (not has_russian or not has_kazakh_chars):
        warnings.append("mixed_language_signal_missing")
    if score < 60:
        warnings.append("low_confidence")
    safety_low_confidence = scenario.id in SAFETY_SCENARIO_IDS and score < 80
    if safety_low_confidence:
        warnings.append("safety_low_confidence")

    confidence = _confidence(score)
    usable = confidence != "unusable"

    return SttScore(
        keyword_hits=keyword_hits,
        missed_keywords=missed_keywords,
        has_russian=has_russian,
        has_kazakh_chars=has_kazakh_chars,
        has_latinized_kazakh=has_latinized_kazakh,
        cyrillic_ratio=cyrillic_ratio,
        likely_wrong_language=likely_wrong_language,
        score=score,
        warnings=warnings,
        confidence=confidence,
        usable=usable,
        requires_callback=not usable or score < 60 or safety_low_confidence or mostly_non_cyrillic_kz,
    )


def _keyword_score(keyword_hits: list[str], expected_keywords: tuple[str, ...]) -> int:
    if not expected_keywords:
        return 80

    return round((len(keyword_hits) / len(expected_keywords)) * 80)


def _language_score(expected_language: str, has_russian: bool, has_kazakh_chars: bool) -> int:
    if expected_language == "kk":
        if has_kazakh_chars:
            return 20
        return 10 if has_russian else 0

    if expected_language == "mixed":
        return (10 if has_russian else 0) + (10 if has_kazakh_chars else 0)

    return 20 if has_russian else 0


def _looks_like_wrong_language(normalized_transcript: str, expected_language: str) -> bool:
    if expected_language not in {"ru", "kk", "mixed"}:
        return False

    return any(marker in normalized_transcript for marker in SPANISH_OR_ENGLISH_JUNK)


def _looks_latinized_kazakh(normalized_transcript: str) -> bool:
    return any(_contains_alias(normalized_transcript, marker) for marker in LATINIZED_KAZAKH_MARKERS)


def _keyword_matches(normalized_transcript: str, keyword: str) -> bool:
    return any(_contains_alias(normalized_transcript, alias) for alias in _keyword_aliases(keyword))


def _keyword_aliases(keyword: str) -> tuple[str, ...]:
    normalized_keyword = _normalize(keyword)
    aliases = KEYWORD_ALIASES.get(normalized_keyword, ())
    return (normalized_keyword, *(_normalize(alias) for alias in aliases))


def _contains_alias(normalized_transcript: str, alias: str) -> bool:
    if not alias:
        return False
    if " " in alias:
        return alias in normalized_transcript

    return re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized_transcript) is not None


def _cyrillic_ratio(value: str) -> float:
    letters = [char for char in value if char.isalpha()]
    if not letters:
        return 0

    cyrillic_count = sum(1 for char in letters if CYRILLIC_CHAR_PATTERN.fullmatch(char))
    return round(cyrillic_count / len(letters), 2)


def _confidence(score: int) -> SttConfidence:
    if score < 40:
        return "unusable"
    if score < 60:
        return "low"
    if score < 80:
        return "medium"
    return "high"


def _normalize(value: str) -> str:
    normalized = value.casefold().replace("ё", "е")
    normalized = re.sub(r"[^\w\s]+", " ", normalized)
    return " ".join(normalized.split())
