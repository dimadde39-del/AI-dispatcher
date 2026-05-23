import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import { z } from "zod";
import { serverEnvSchema } from "../src/lib/env";
import { REQUIRED_TABLES } from "./db-tables";
import { loadEnvFiles } from "./load-env";

const migrationPath = "supabase/migrations/202605230001_initial_product_foundation.sql";

function assertNoForbiddenSql(sqlText: string): void {
  const forbiddenPatterns = [
    /\bdrop\s+table\b/i,
    /\bdelete\s+from\b/i,
    /\btruncate\b/i,
    /\balter\s+table\b[\s\S]*\bdrop\s+column\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sqlText)) {
      throw new Error("Migration contains forbidden destructive SQL.");
    }
  }
}

function requireDbUrl(env: z.infer<typeof serverEnvSchema>): string {
  if (!env.SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is required to run database migrations from this machine.");
  }

  return env.SUPABASE_DB_URL;
}

async function getExistingTables(sql: postgres.Sql): Promise<Set<string>> {
  const rows = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${REQUIRED_TABLES})
  `;

  return new Set(rows.map((row) => row.table_name));
}

function missingTables(existingTables: Set<string>): string[] {
  return REQUIRED_TABLES.filter((table) => !existingTables.has(table));
}

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
  const dbUrl = requireDbUrl(env);
  const migrationSql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
  assertNoForbiddenSql(migrationSql);

  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    ssl: "require",
  });

  try {
    const beforeTables = await getExistingTables(sql);
    const beforeMissing = missingTables(beforeTables);

    if (beforeMissing.length === 0) {
      console.log("Migration skipped: required tables already exist.");
      return;
    }

    console.log(`Applying migration: ${migrationPath}`);
    await sql.unsafe(migrationSql);

    const afterTables = await getExistingTables(sql);
    const afterMissing = missingTables(afterTables);
    if (afterMissing.length > 0) {
      throw new Error(`Migration completed but these tables are missing: ${afterMissing.join(", ")}`);
    }

    console.log("Migration applied successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
