import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { Client } from 'pg';
import { initDatabase, initMarketplaceTables, db as appDb } from '../src/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const defaultSqlitePath = path.join(backendDir, 'data', 'applications.db');
const TARGET_SCHEMA = 'vlgn';
const PARAMETER_LIMIT = 60000;

function resolveSqlitePath() {
  return path.resolve(process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || defaultSqlitePath);
}

function resolveSsl(databaseUrl) {
  const mode = String(process.env.PGSSLMODE || '').trim().toLowerCase();
  const isLocalHost = /(?:^|\/\/)(localhost|127\.0\.0\.1|::1)(?::\d+)?(?:\/|$)/i.test(databaseUrl);
  if (mode === 'disable' || isLocalHost) return false;
  return { rejectUnauthorized: false };
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function parseTableList(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function chunkRows(rows, columnCount, requestedBatchSize) {
  const safeBatchSize = Math.max(1, Math.min(requestedBatchSize, Math.floor(PARAMETER_LIMIT / Math.max(1, columnCount))));
  const chunks = [];
  for (let index = 0; index < rows.length; index += safeBatchSize) {
    chunks.push(rows.slice(index, index + safeBatchSize));
  }
  return chunks;
}

async function createPgClient(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl),
  });
  await client.connect();
  await client.query(`SET search_path TO ${TARGET_SCHEMA}, public`);
  return client;
}

async function listTargetTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [TARGET_SCHEMA]);
  return result.rows.map((row) => row.table_name);
}

async function getTargetColumns(client, table) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
  `, [TARGET_SCHEMA, table]);
  return result.rows.map((row) => row.column_name);
}

async function getSqliteTables(sqliteDb) {
  const requestedTables = new Set(parseTableList(process.env.MIGRATE_TABLES));
  const rows = await sqliteDb.all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const names = rows.map((row) => row.name);
  if (requestedTables.size === 0) return names;

  const unknown = [...requestedTables].filter((table) => !names.includes(table));
  if (unknown.length > 0) {
    throw new Error(`Requested table(s) not found in SQLite: ${unknown.join(', ')}`);
  }
  return names.filter((name) => requestedTables.has(name));
}

async function getSqliteColumns(sqliteDb, table) {
  const rows = await sqliteDb.all(`PRAGMA table_info(${quoteIdent(table)})`);
  return rows.map((row) => row.name);
}

async function getSqliteCount(sqliteDb, table) {
  const row = await sqliteDb.get(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(table)}`);
  return Number(row?.row_count || 0);
}

async function getTargetCount(client, table) {
  const result = await client.query(`SELECT COUNT(*)::bigint AS row_count FROM ${quoteIdent(table)}`);
  return Number(result.rows[0]?.row_count || 0);
}

async function ensureEmptyTarget(databaseUrl) {
  const client = await createPgClient(databaseUrl);
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${TARGET_SCHEMA}`);
    await client.query(`SET search_path TO ${TARGET_SCHEMA}, public`);
    const existingTables = await listTargetTables(client);
    if (existingTables.length > 0 && process.env.MIGRATE_ALLOW_EXISTING_TARGET !== '1') {
      throw new Error(
        `Target schema ${TARGET_SCHEMA} already has table(s): ${existingTables.join(', ')}. ` +
        'Refusing to continue without MIGRATE_ALLOW_EXISTING_TARGET=1.'
      );
    }
  } finally {
    await client.end();
  }
}

async function initializeTargetSchema(databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  await initDatabase();
  await initMarketplaceTables();

  if (appDb && typeof appDb.close === 'function') {
    await appDb.close();
  }
}

async function insertRows(client, table, columns, rows, batchSize) {
  if (rows.length === 0 || columns.length === 0) return 0;

  let inserted = 0;
  const columnSql = columns.map(quoteIdent).join(', ');
  const rowChunks = chunkRows(rows, columns.length, batchSize);

  for (const chunk of rowChunks) {
    const values = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const fields = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${fields.join(', ')})`;
    });

    const result = await client.query(
      `INSERT INTO ${quoteIdent(table)} (${columnSql}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    );
    inserted += Number(result.rowCount || 0);
  }

  return inserted;
}

async function resetSerialSequences(client) {
  const result = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND column_default LIKE 'nextval(%'
    ORDER BY table_name, ordinal_position
  `, [TARGET_SCHEMA]);

  for (const row of result.rows) {
    const table = row.table_name;
    const column = row.column_name;
    const seqResult = await client.query('SELECT pg_get_serial_sequence($1, $2) AS sequence_name', [`${TARGET_SCHEMA}.${table}`, column]);
    const sequenceName = seqResult.rows[0]?.sequence_name;
    if (!sequenceName) continue;

    await client.query(
      `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(${quoteIdent(column)}), 0) FROM ${quoteIdent(table)}), 1), true)`,
      [sequenceName]
    );
  }
}

async function migrateTable({ sqliteDb, client, table, batchSize, writeEnabled }) {
  const sqliteColumns = await getSqliteColumns(sqliteDb, table);
  const targetColumns = writeEnabled ? await getTargetColumns(client, table) : [];
  const columns = writeEnabled ? sqliteColumns.filter((column) => targetColumns.includes(column)) : sqliteColumns;
  const sourceCount = await getSqliteCount(sqliteDb, table);

  if (!writeEnabled) {
    return { table, source_count: sourceCount, target_before: null, inserted: 0, target_after: null, columns };
  }

  if (targetColumns.length === 0) {
    return { table, source_count: sourceCount, target_before: null, inserted: 0, target_after: null, skipped: 'target table missing' };
  }

  if (columns.length === 0) {
    return { table, source_count: sourceCount, target_before: await getTargetCount(client, table), inserted: 0, target_after: await getTargetCount(client, table), skipped: 'no shared columns' };
  }

  const targetBefore = await getTargetCount(client, table);
  const rows = await sqliteDb.all(`SELECT ${columns.map(quoteIdent).join(', ')} FROM ${quoteIdent(table)}`);

  await client.query('BEGIN');
  try {
    const inserted = await insertRows(client, table, columns, rows, batchSize);
    await client.query('COMMIT');
    const targetAfter = await getTargetCount(client, table);
    return { table, source_count: sourceCount, target_before: targetBefore, inserted, target_after: targetAfter, columns };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const sqlitePath = resolveSqlitePath();
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const writeEnabled = process.env.MIGRATE_WRITE === '1';
  const batchSize = Math.max(1, Number.parseInt(process.env.MIGRATE_BATCH_SIZE || '500', 10));

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sqliteDb = await open({
    filename: sqlitePath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY,
  });

  let client = null;
  const report = {
    mode: writeEnabled ? 'write' : 'dry-run',
    sqlite_path: sqlitePath,
    target_schema: TARGET_SCHEMA,
    generated_at: new Date().toISOString(),
    tables: [],
  };

  try {
    const tables = await getSqliteTables(sqliteDb);

    if (!writeEnabled) {
      client = await createPgClient(databaseUrl);
      report.target_existing_tables = await listTargetTables(client);
      for (const table of tables) {
        report.tables.push(await migrateTable({ sqliteDb, client, table, batchSize, writeEnabled }));
      }
      console.log(JSON.stringify(report, null, 2));
      console.log('[sqlite-to-postgres] Dry-run only. Set MIGRATE_WRITE=1 to import.');
      return;
    }

    await ensureEmptyTarget(databaseUrl);
    await initializeTargetSchema(databaseUrl);
    client = await createPgClient(databaseUrl);

    for (const table of tables) {
      report.tables.push(await migrateTable({ sqliteDb, client, table, batchSize, writeEnabled }));
    }

    await resetSerialSequences(client);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (client) await client.end();
    await sqliteDb.close();
  }
}

main().catch((error) => {
  console.error('[sqlite-to-postgres] Failed:', error.message);
  process.exitCode = 1;
});
