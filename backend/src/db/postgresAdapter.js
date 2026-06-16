import { Client } from 'pg';

export const POSTGRES_SCHEMA = 'vlgn';

const compatibilityPromises = new Map();

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  return [params];
}

function stripIdentifierQuotes(value) {
  return String(value || '').trim().replace(/^["'`[]|["'`\]]$/g, '');
}

function normalizeSql(sql) {
  let text = String(sql || '').trim();

  const hadInsertOrIgnore = /^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(text);
  if (hadInsertOrIgnore) {
    text = text.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    if (!/\bON\s+CONFLICT\b/i.test(text)) {
      text += ' ON CONFLICT DO NOTHING';
    }
  }

  text = text
    .replace(/^\s*BEGIN\s+IMMEDIATE\s+TRANSACTION\s*;?$/i, 'BEGIN')
    .replace(/^\s*BEGIN\s+IMMEDIATE\s*;?$/i, 'BEGIN')
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY')
    .replace(/=\s*"active"/g, "= 'active'")
    .replace(/GROUP BY c\.id\s+ORDER BY/g, 'GROUP BY c.id, comp.name, comp.company_code ORDER BY')
    .replace(/c\.company_id,\s*comp\.name AS company_name,\s*comp\.company_code,\s*COUNT\(\*\) AS pending_count,/g, 'c.company_id, MAX(comp.name) AS company_name, MAX(comp.company_code) AS company_code, COUNT(*) AS pending_count,')
    .replace(/ORDER BY total_pending_fees DESC, comp\.name ASC/g, 'ORDER BY total_pending_fees DESC, MAX(comp.name) ASC');

  return text;
}

function toPgQuery(sql, params = []) {
  const values = normalizeParams(params);
  let text = normalizeSql(sql);

  if (values.length > 0) {
    let index = 0;
    text = text.replace(/\?/g, () => `$${++index}`);
  }

  return { text, values };
}

async function ensurePostgresCompatibility(client, schema = POSTGRES_SCHEMA) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

  await client.query(`
    DO $$
    BEGIN
      CREATE DOMAIN ${schema}.datetime AS timestamp;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${schema}.datetime(value text)
    RETURNS timestamp
    LANGUAGE plpgsql
    STABLE
    AS $$
    BEGIN
      IF value IS NULL OR btrim(value) = '' THEN
        RETURN NULL;
      END IF;

      IF lower(btrim(value)) IN ('now', 'current_timestamp') THEN
        RETURN CURRENT_TIMESTAMP::timestamp;
      END IF;

      BEGIN
        RETURN value::timestamptz::timestamp;
      EXCEPTION
        WHEN others THEN
          RETURN value::timestamp;
      END;
    END;
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${schema}.datetime(value timestamp)
    RETURNS timestamp
    LANGUAGE sql
    STABLE
    AS $$ SELECT $1 $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${schema}.datetime(value timestamptz)
    RETURNS timestamp
    LANGUAGE sql
    STABLE
    AS $$ SELECT $1::timestamp $$;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${schema}.datetime(base text, modifier text)
    RETURNS timestamp
    LANGUAGE plpgsql
    STABLE
    AS $$
    DECLARE
      ts timestamp;
      normalized_modifier text := lower(btrim(COALESCE(modifier, '')));
      match text[];
      quantity int;
      unit text;
    BEGIN
      IF base IS NULL THEN
        RETURN NULL;
      END IF;

      IF lower(btrim(base)) IN ('now', 'current_timestamp') THEN
        ts := CURRENT_TIMESTAMP::timestamp;
      ELSE
        BEGIN
          ts := base::timestamptz::timestamp;
        EXCEPTION
          WHEN others THEN
            ts := base::timestamp;
        END;
      END IF;

      IF normalized_modifier = '' THEN
        RETURN ts;
      END IF;

      match := regexp_match(normalized_modifier, '^([+-]?\d+)\s+([a-z]+)$');
      IF match IS NULL THEN
        RETURN ts;
      END IF;

      quantity := match[1]::int;
      unit := match[2];

      IF unit LIKE 'day%' THEN
        RETURN ts + make_interval(days => quantity);
      ELSIF unit LIKE 'hour%' THEN
        RETURN ts + make_interval(hours => quantity);
      ELSIF unit LIKE 'minute%' THEN
        RETURN ts + make_interval(mins => quantity);
      ELSIF unit LIKE 'second%' THEN
        RETURN ts + make_interval(secs => quantity);
      ELSIF unit LIKE 'week%' THEN
        RETURN ts + make_interval(days => quantity * 7);
      END IF;

      RETURN ts;
    END;
    $$;
  `);

  await client.query(`
    CREATE OR REPLACE VIEW ${schema}.sqlite_master AS
    SELECT
      CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'v' THEN 'view'
        WHEN 'i' THEN 'index'
        WHEN 'S' THEN 'sequence'
        ELSE c.relkind::text
      END AS type,
      c.relname AS name,
      c.relname AS tbl_name,
      CASE
        WHEN c.relkind = 'v' THEN pg_get_viewdef(c.oid, true)
        ELSE NULL
      END AS sql
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'v', 'i', 'S');
  `);
}

async function ensurePostgresCompatibilityOnce(client, schema = POSTGRES_SCHEMA) {
  const key = String(schema || POSTGRES_SCHEMA);
  if (!compatibilityPromises.has(key)) {
    const promise = ensurePostgresCompatibility(client, key).catch((error) => {
      compatibilityPromises.delete(key);
      throw error;
    });
    compatibilityPromises.set(key, promise);
  }
  return compatibilityPromises.get(key);
}

function parsePragmaTableInfo(sql) {
  const match = String(sql || '').match(/PRAGMA\s+table_info\s*\(\s*([^)]+)\s*\)/i);
  if (!match) return '';
  return stripIdentifierQuotes(match[1]);
}

function normalizeCallbackParams(params, callback) {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }
  if (params === undefined || params === null) {
    return { params: [], callback };
  }
  return { params: Array.isArray(params) ? params : [params], callback };
}

export class PostgresCompatDb {
  constructor(client, schema = POSTGRES_SCHEMA) {
    this.client = client;
    this.schema = schema;
    this.dialect = 'postgres';
  }

  async _tableInfo(table) {
    const result = await this.client.query(`
      SELECT
        a.attnum - 1 AS cid,
        a.attname AS name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
        CASE WHEN a.attnotnull THEN 1 ELSE 0 END AS notnull,
        pg_get_expr(ad.adbin, ad.adrelid) AS dflt_value,
        CASE WHEN pk.primary_key IS NOT NULL THEN 1 ELSE 0 END AS pk
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      LEFT JOIN (
        SELECT ku.table_schema, ku.table_name, ku.column_name AS primary_key
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
         AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.table_schema = n.nspname AND pk.table_name = c.relname AND pk.primary_key = a.attname
      WHERE n.nspname = current_schema()
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `, [table]);

    return result.rows;
  }

  async _query(sql, params = []) {
    const trimmed = String(sql || '').trim();

    if (/^PRAGMA\s+table_info\s*\(/i.test(trimmed)) {
      return { rows: await this._tableInfo(parsePragmaTableInfo(trimmed)), rowCount: 0 };
    }

    if (/^PRAGMA\b/i.test(trimmed)) {
      return { rows: [], rowCount: 0 };
    }

    const { text, values } = toPgQuery(trimmed, params);
    const needsReturningId = /^INSERT\b/i.test(trimmed) && !/\bRETURNING\b/i.test(text);
    const finalText = needsReturningId ? `${text} RETURNING id` : text;
    return this.client.query(finalText, values);
  }

  _resolvePromise(result, map = (value) => value) {
    return Promise.resolve(result).then(map);
  }

  run(sql, params, callback) {
    const { params: normalizedParams, callback: normalizedCallback } = normalizeCallbackParams(params, callback);
    const promise = this._query(sql, normalizedParams).then((result) => {
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const lastRow = rows[rows.length - 1] || rows[0] || null;
      return {
        lastID: lastRow ? (lastRow.id ?? lastRow.ID ?? lastRow[Object.keys(lastRow)[0]] ?? null) : null,
        changes: Number(result?.rowCount || 0),
      };
    });

    if (typeof normalizedCallback === 'function') {
      promise.then(
        (result) => normalizedCallback.call(result, null),
        (error) => normalizedCallback.call({ lastID: null, changes: 0 }, error)
      );
      return undefined;
    }

    return promise;
  }

  get(sql, params, callback) {
    const { params: normalizedParams, callback: normalizedCallback } = normalizeCallbackParams(params, callback);
    const promise = this._query(sql, normalizedParams).then((result) => (result?.rows || [])[0]);

    if (typeof normalizedCallback === 'function') {
      promise.then(
        (row) => normalizedCallback(null, row),
        (error) => normalizedCallback(error)
      );
      return undefined;
    }

    return promise;
  }

  all(sql, params, callback) {
    const { params: normalizedParams, callback: normalizedCallback } = normalizeCallbackParams(params, callback);
    const promise = this._query(sql, normalizedParams).then((result) => result?.rows || []);

    if (typeof normalizedCallback === 'function') {
      promise.then(
        (rows) => normalizedCallback(null, rows),
        (error) => normalizedCallback(error)
      );
      return undefined;
    }

    return promise;
  }

  exec(sql, callback) {
    const statements = String(sql || '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    const promise = (async () => {
      let totalChanges = 0;
      let lastID = null;

      for (const statement of statements) {
        if (/^PRAGMA\b/i.test(statement)) {
          continue;
        }

        const result = await this.run(statement);
        totalChanges += Number(result?.changes || 0);
        if (result?.lastID !== undefined && result?.lastID !== null) {
          lastID = result.lastID;
        }
      }

      return { changes: totalChanges, lastID };
    })();

    if (typeof callback === 'function') {
      promise.then(
        (result) => callback.call(result, null),
        (error) => callback(error)
      );
      return undefined;
    }

    return promise;
  }

  close(callback) {
    const promise = this.client.end();
    if (typeof callback === 'function') {
      promise.then(
        () => callback(null),
        (error) => callback(error)
      );
      return undefined;
    }
    return promise;
  }
}

export async function createPostgresCompatDb(databaseUrl, schema = POSTGRES_SCHEMA) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Postgres connections');
  }

  const sslMode = String(process.env.PGSSLMODE || '').trim().toLowerCase();
  const isLocalHost = /(?:^|\/\/)(localhost|127\.0\.0\.1|::1)(?::\d+)?(?:\/|$)/i.test(databaseUrl);
  const ssl = sslMode === 'disable' || isLocalHost ? false : { rejectUnauthorized: false };

  const client = new Client({
    connectionString: databaseUrl,
    ssl,
  });

  await client.connect();
  await ensurePostgresCompatibilityOnce(client, schema);
  await client.query(`SET search_path TO ${schema}, public`);

  return new PostgresCompatDb(client, schema);
}
