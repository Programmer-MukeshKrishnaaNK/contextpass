#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the database in SUPABASE_DB_URL, in
 * order, each in its own transaction. Applied versions are recorded in
 * supabase_migrations.schema_migrations (the table the Supabase CLI uses),
 * so the CLI and this script agree on what has run.
 *
 * Reads .env.local. Never prints the connection string.
 *
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --status  list applied / pending
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const root = new URL("..", import.meta.url).pathname;

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(join(root, ".env.local"));

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set (add it to .env.local).");
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const { rows } = await client.query(`select version from supabase_migrations.schema_migrations`);
  const applied = new Set(rows.map((r) => r.version));

  if (process.argv.includes("--status")) {
    for (const f of files) console.log(`${applied.has(f.split("_")[0]) ? "applied" : "pending"}  ${f}`);
    process.exit(0);
  }

  let ran = 0;
  for (const f of files) {
    const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    const sql = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`applying ${f} … `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(`insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)`, [version, rest.join("_")]);
      await client.query("commit");
      console.log("ok");
      ran++;
    } catch (error) {
      await client.query("rollback");
      console.log("failed");
      console.error(`  ${error.message}`);
      process.exit(1);
    }
  }
  console.log(ran ? `${ran} migration(s) applied.` : "Database is up to date.");
} finally {
  await client.end();
}
