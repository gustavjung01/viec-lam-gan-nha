import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const defaultDbPath = path.join(backendDir, 'data', 'applications.db');

function resolveSqlitePath() {
  return path.resolve(process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || defaultDbPath);
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function main() {
  const dbPath = resolveSqlitePath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found: ${dbPath}`);
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    mode: sqlite3.OPEN_READONLY,
  });

  try {
    const objects = await db.all(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE type IN ('table', 'view', 'index', 'trigger')
      ORDER BY type, name
    `);

    const tables = objects.filter((object) => object.type === 'table' && !object.name.startsWith('sqlite_'));
    const tableDetails = [];

    for (const table of tables) {
      const columns = await db.all(`PRAGMA table_info(${quoteIdent(table.name)})`);
      const foreignKeys = await db.all(`PRAGMA foreign_key_list(${quoteIdent(table.name)})`);
      const countRow = await db.get(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(table.name)}`);
      tableDetails.push({
        name: table.name,
        row_count: Number(countRow?.row_count || 0),
        columns: columns.map((column) => ({
          cid: column.cid,
          name: column.name,
          type: column.type,
          notnull: column.notnull,
          dflt_value: column.dflt_value,
          pk: column.pk,
        })),
        foreign_keys: foreignKeys,
      });
    }

    const summary = {
      sqlite_path: dbPath,
      generated_at: new Date().toISOString(),
      tables: tableDetails,
      objects: objects.map((object) => ({
        type: object.type,
        name: object.name,
        table: object.tbl_name,
        has_sql: Boolean(object.sql),
      })),
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('[sqlite-schema-audit] Failed:', error.message);
  process.exitCode = 1;
});
