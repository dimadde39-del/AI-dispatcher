from dataclasses import dataclass


@dataclass(frozen=True)
class SttScenario:
    id: str
    label: str
    expected_keywords: tuple[str, ...]
    expected_language: str
    original_text: str

    def to_public_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "expected_keywords": list(self.expected_keywords),
            "expected_language": self.expected_language,
            "original_text": self.original_text,
        }


STT_SCENARIOS: dict[str, SttScenario] = {
    "ru-urgent-plumbing": SttScenario(
        id="ru-urgent-plumbing",
        label="RU urgent plumbing",
        expected_keywords=("труба", "течет", "ванной", "Шымкент", "Нурсат", "срочно", "Дима"),
        expected_language="ru",
        original_text=(
            "Здравствуйте, у меня труба течет под ванной. Адрес Шымкент, Нурсат, дом 15. "
            "Срочно. Меня зовут Дима."
        ),
    ),
    "kz-water-leak": SttScenario(
        id="kz-water-leak",
        label="KZ water leak",
        expected_keywords=("су", "ағып жатыр", "Шымкент", "Тұран", "тезірек", "Дима"),
        expected_language="kk",
        original_text="Су ағып жатыр. Шымкент, Тұран жақта. Тезірек керек. Атым Дима.",
    ),
    "mix-ru-kz-water-leak": SttScenario(
        id="mix-ru-kz-water-leak",
        label="MIX RU/KZ water leak",
        expected_keywords=("су", "ағып жатыр", "течь", "Шымкент", "Тұран", "этаж", "тезірек", "Дима"),
        expected_language="mixed",
        original_text=(
            "Аға, су ағып жатыр, ваннаның астынан течь. Шымкент, Тұран жақта, 5 этаж. "
            "Тезірек керек. Атым Дима."
        ),
    ),
    "kz-fast-plumbing": SttScenario(
        id="kz-fast-plumbing",
        label="KZ fast plumbing",
        expected_keywords=("су", "ағып жатыр", "кран", "тезірек", "Шымкент", "Нұрсат", "он бесінші"),
        expected_language="kk",
        original_text="Аға су ағып жатыр краннан тезірек келіңіз Шымкент Нұрсат он бесінші үй",
    ),
    "kz-slang-noisy": SttScenario(
        id="kz-slang-noisy",
        label="KZ slang/noisy",
        expected_keywords=("аға", "су", "кетіп жатыр", "кран", "бала", "тез"),
        expected_language="kk",
        original_text="алло аға шшс су кетіп жатыр краннан бала жылап жатыр тез келіңіз",
    ),
    "mix-fast-plumbing": SttScenario(
        id="mix-fast-plumbing",
        label="MIX fast plumbing",
        expected_keywords=("су", "ағып жатыр", "труба", "течет", "Шымкент", "Нұрсат", "тезірек"),
        expected_language="mixed",
        original_text="аға су ағып жатыр труба течет Шымкент Нурсат тезірек керек",
    ),
    "mix-spouse-background": SttScenario(
        id="mix-spouse-background",
        label="MIX spouse background",
        expected_keywords=("сантехник", "муж", "кран", "течет", "тезірек", "Нұрсат", "он бес"),
        expected_language="mixed",
        original_text="әй алло сантехник па муж говорит кран течет тезірек келсін адрес Нурсат дом он бес",
    ),
    "gas-kz-ru": SttScenario(
        id="gas-kz-ru",
        label="GAS KZ/RU",
        expected_keywords=("газ", "иісі", "пахнет", "Шымкент", "Нұрсат"),
        expected_language="mixed",
        original_text="үйде газ иісі бар пахнет газом Шымкент Нурсат не знаю что делать",
    ),
    "gas-emergency": SttScenario(
        id="gas-emergency",
        label="GAS emergency",
        expected_keywords=("газ", "иісі", "пахнет", "Шымкент", "Нурсат"),
        expected_language="mixed",
        original_text="Үйде газ иісі шығып тұр. Пахнет газом, не знаю что делать. Шымкент, Нурсат.",
    ),
    "electric-danger": SttScenario(
        id="electric-danger",
        label="ELECTRIC danger",
        expected_keywords=("проводка", "искрит", "запах", "гари", "свет", "мигает", "Алматы", "срочно"),
        expected_language="ru",
        original_text="Проводка искрит, запах гари, свет мигает. Алматы, Бостандык, срочно.",
    ),
    "noisy-unclear-fallback": SttScenario(
        id="noisy-unclear-fallback",
        label="Noisy/unclear fallback phrase",
        expected_keywords=("плохо", "слышно", "мастер", "вода", "течет"),
        expected_language="ru",
        original_text="Алло, плохо слышно, связь пропадает. Нужен мастер, вода где-то течет.",
    ),
}


STT_SCENARIO_ORDER = [
    "ru-urgent-plumbing",
    "kz-water-leak",
    "mix-ru-kz-water-leak",
    "kz-fast-plumbing",
    "kz-slang-noisy",
    "mix-fast-plumbing",
    "mix-spouse-background",
    "gas-kz-ru",
    "gas-emergency",
    "electric-danger",
    "noisy-unclear-fallback",
]


def list_stt_scenarios() -> list[SttScenario]:
    return [STT_SCENARIOS[scenario_id] for scenario_id in STT_SCENARIO_ORDER]


def get_stt_scenario(scenario_id: str) -> SttScenario:
    normalized = scenario_id.strip().lower()
    if normalized not in STT_SCENARIOS:
        raise KeyError(normalized)

    return STT_SCENARIOS[normalized]
