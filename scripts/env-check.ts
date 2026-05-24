import { serverEnvSchema } from "../src/lib/env";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();

const result = serverEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPI_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
  NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL: process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  VAPI_API_KEY: process.env.VAPI_API_KEY,
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET,
  VAPI_ASSISTANT_ID: process.env.VAPI_ASSISTANT_ID,
  SELF_HOST_VOICE_WEBHOOK_SECRET: process.env.SELF_HOST_VOICE_WEBHOOK_SECRET,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  APP_BASE_URL: process.env.APP_BASE_URL,
  ENABLE_DEV_VAPI_WEB_CALL: process.env.ENABLE_DEV_VAPI_WEB_CALL,
  ENABLE_DEV_SELFHOST_STT: process.env.ENABLE_DEV_SELFHOST_STT,
});

if (!result.success) {
  console.error("Environment validation failed for these keys:");
  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".") || "environment"}: ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  console.log("Environment validation passed.");
}
