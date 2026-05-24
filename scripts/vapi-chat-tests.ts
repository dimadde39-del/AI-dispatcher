import { DISPATCHER_POLICY_SCENARIOS } from "./dispatcher-policy-scenarios";
import { loadEnvFiles } from "./load-env";

const VAPI_CHAT_URL = "https://api.vapi.ai/chat";
const DEFAULT_ASSISTANT_ID = "cc79d655-ed1f-47fb-ab03-a55558e8f48a";

interface VapiChatMessage {
  role?: string;
  content?: string;
}

interface VapiChatResponse {
  id?: string;
  output?: VapiChatMessage[];
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function assistantOutput(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "(response body was not an object)";
  }

  const response = body as VapiChatResponse;
  const firstText = response.output?.find((message) => typeof message.content === "string")?.content?.trim();
  return firstText || "(no assistant text output found)";
}

async function postScenario(apiKey: string, assistantId: string, input: string): Promise<Response> {
  return fetch(VAPI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      input,
    }),
  });
}

async function main() {
  loadEnvFiles();

  const apiKey = process.env.VAPI_API_KEY;
  if (!isPresent(apiKey)) {
    console.log("Skipping Vapi Chat tests: VAPI_API_KEY is missing.");
    console.log("Local dispatcher policy tests are available with: npm run dispatcher:policy-tests");
    return;
  }

  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim() || DEFAULT_ASSISTANT_ID;

  console.log("Vapi Chat behavior smoke tests");
  console.log(`- Assistant ID: ${assistantId}`);
  console.log("- API key present: yes");
  console.log("- Note: Vapi Chat may require billing/payment method.");
  console.log("");

  for (const scenario of DISPATCHER_POLICY_SCENARIOS) {
    const response = await postScenario(apiKey, assistantId, scenario.callerMessage);

    if (response.status === 402) {
      console.log("Vapi Chat requires billing/payment method.");
      return;
    }

    if (!response.ok) {
      console.error(`Vapi Chat scenario ${scenario.id} failed with HTTP ${response.status}. Response body omitted.`);
      process.exitCode = 1;
      return;
    }

    const body = (await response.json()) as unknown;
    console.log(`## ${scenario.id}. ${scenario.title}`);
    console.log(`Caller: ${scenario.callerMessage}`);
    console.log(`Assistant: ${assistantOutput(body)}`);
    console.log("Manual checks:");
    console.log("- Russian response / suitable short KZ acknowledgement");
    console.log("- No price");
    console.log("- No exact arrival promise");
    console.log("- No repair advice");
    console.log(`- Emergency handling expected: ${scenario.emergencyExpected ? "yes" : "no"}`);
    console.log("");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Vapi Chat test error";
  console.error(`Vapi Chat tests failed: ${message}`);
  process.exitCode = 1;
});
