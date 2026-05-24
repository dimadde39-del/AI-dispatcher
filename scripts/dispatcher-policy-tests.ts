import { DISPATCHER_POLICY_SCENARIOS } from "./dispatcher-policy-scenarios";

function printList(label: string, values: readonly string[]): void {
  console.log(`${label}:`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

console.log("Master Dispatcher local policy checklist");
console.log("Основной язык чеклиста: русский");
console.log("Примеры клиентов: русский, казахский и смешанный RU/KZ");
console.log("Важно: это ручные behavior-чеклисты, не STT/audio/webhook validation.");
console.log("");

for (const scenario of DISPATCHER_POLICY_SCENARIOS) {
  console.log(`## ${scenario.id}. ${scenario.title}`);
  console.log(`Сообщение клиента: ${scenario.callerMessage}`);
  printList("Должно сделать", scenario.mustBehavior);
  printList("Не должно делать", scenario.mustNotBehavior);
  console.log(`Аварийная ситуация ожидается: ${scenario.emergencyExpected ? "да" : "нет"}`);
  console.log("Поля ручной оценки:");
  console.log("- Ответил(а) по-русски или уместно подтвердил(а) KZ фразу: pass/fail");
  console.log("- Собрал(а) проблема + адрес/район + срочность + имя: pass/fail");
  console.log("- Не назвал(а) цену: pass/fail");
  console.log("- Не обещал(а) точное время: pass/fail");
  console.log("- Не дал(а) ремонтный совет: pass/fail");
  console.log("- Аварийная инструкция 112 дана, если нужна: pass/fail/not-applicable");
  console.log("- Мастер-сводка/Telegram остается на русском: pass/fail");
  console.log("");
}
