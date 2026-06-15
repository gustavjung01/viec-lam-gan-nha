#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
const values = new Map(Object.entries(process.env));

for (const file of envFiles) {
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
}

const required = ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_ONESIGNAL_APP_ID'];
const missing = required.filter((key) => !String(values.get(key) || '').trim());

if (missing.length > 0) {
  console.error('[frontend-env] Missing required public build env:');
  for (const key of missing) console.error(`- ${key}`);
  console.error('Build stopped to avoid shipping a PWA without Clerk or OneSignal identity.');
  process.exit(1);
}

console.log('[frontend-env] VITE_CLERK_PUBLISHABLE_KEY=SET');
console.log('[frontend-env] VITE_ONESIGNAL_APP_ID=SET');
