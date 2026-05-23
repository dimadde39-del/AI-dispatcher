import postgres from "postgres";
import { serverEnvSchema } from "../src/lib/env";
import { REQUIRED_TABLES } from "./db-tables";
import { loadEnvFiles } from "./load-env";

async function main() {
  loadEnvFiles();
  const env = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    VAPI_API_KEY: process.env.VAPI_API_KEY,
    VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    APP_BASE_URL: process.env.APP_BASE_URL,
  });

  if (!env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is required for schema verification.");
  }

  const sql = postgres(env.SUPABASE_DB_URL, {
    max: 1,
    prepare: false,
    ssl: "require",
  });

  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any(${REQUIRED_TABLES})
      order by table_name
    `;
    const found = new Set(rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((table) => !found.has(table));

    if (missing.length > 0) {
      throw new Error(`Missing tables: ${missing.join(", ")}`);
    }

    console.log(`Verified tables: ${REQUIRED_TABLES.join(", ")}`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown schema verification error";
  console.error(`Schema verification failed: ${message}`);
  process.exitCode = 1;
});
