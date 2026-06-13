#!/usr/bin/env node
import { execSync } from 'child_process';
import { readdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

function shortGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function findIndexAsset(distPath) {
  try {
    const assetsDir = join(distPath, 'assets');
    const files = readdirSync(assetsDir);
    for (const f of files) {
      if (/^index-.*\.js$/.test(f)) return `assets/${f}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const distPath = process.cwd() + '/dist';
  const commit = shortGitHash();
  const buildTime = new Date().toISOString();
  const indexAsset = findIndexAsset(distPath);

  const info = {
    commit: commit || 'unknown',
    buildTime,
    indexAsset: indexAsset || null
  };

  try {
    writeFileSync(join(distPath, 'build-info.json'), JSON.stringify(info, null, 2), 'utf8');
    console.log('Wrote', join(distPath, 'build-info.json'));
  } catch (e) {
    console.error('Failed to write build-info.json', e);
    process.exit(2);
  }
}

main();
