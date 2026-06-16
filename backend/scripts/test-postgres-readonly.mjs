import { Client } from 'pg';

function resolveSsl(databaseUrl) {
  const mode = String(process.env.PGSSLMODE || '').trim().toLowerCase();
  const isLocalHost = /(?:^|\/\/)(localhost|127\.0\.0\.1|::1)(?::\d+)?(?:\/|$)/i.test(databaseUrl);
  if (mode === 'disable' || isLocalHost) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl),
  });

  await client.connect();
  try {
    await client.query('SET search_path TO vlgn, public');

    const identity = await client.query(`
      SELECT
        current_database() AS current_database,
        current_schema() AS current_schema,
        current_user AS current_user,
        current_setting('search_path') AS search_path
    `);

    console.log('===== PG IDENTITY =====');
    console.log(JSON.stringify(identity.rows[0], null, 2));

    const schemaExists = await client.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_namespace
        WHERE nspname = 'vlgn'
      ) AS schema_exists
    `);

    console.log('===== PG SCHEMA =====');
    console.log(JSON.stringify(schemaExists.rows[0], null, 2));

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'vlgn'
      ORDER BY table_name
    `);

    console.log('===== PG TABLES IN vlgn =====');
    console.log(JSON.stringify(tables.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[postgres-readonly-test] Failed:', error.message);
  process.exitCode = 1;
});
