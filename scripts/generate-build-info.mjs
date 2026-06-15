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

function listAssets(distPath) {
  try {
    const assetsDir = join(distPath, 'assets');
    return readdirSync(assetsDir).map((file) => `assets/${file}`);
  } catch (e) {
    return [];
  }
}

function extractHtmlAssets(distPath, htmlFile) {
  try {
    const html = readFileSync(join(distPath, htmlFile), 'utf8');
    const assets = new Set();
    const pattern = /(?:src|href)=["']\/?(assets\/[^"']+)["']/g;
    let match;
    while ((match = pattern.exec(html))) assets.add(match[1]);
    return [...assets].sort();
  } catch (e) {
    return [];
  }
}

function pickEntryAsset(assets, fallbackAssets, entryName) {
  return (
    assets.find((asset) => new RegExp(`^assets/${entryName}-.*\\.js$`).test(asset)) ||
    assets.find((asset) => asset.endsWith('.js')) ||
    fallbackAssets.find((asset) => new RegExp(`^assets/${entryName}-.*\\.js$`).test(asset)) ||
    null
  );
}

async function main() {
  const distPath = process.cwd() + '/dist';
  const commit = shortGitHash();
  const buildTime = new Date().toISOString();
  const allAssets = listAssets(distPath);
  const indexAssets = extractHtmlAssets(distPath, 'index.html');
  const adminAssets = extractHtmlAssets(distPath, 'admin.html');
  const indexAsset = pickEntryAsset(indexAssets, allAssets, 'index');
  const adminAsset = pickEntryAsset(adminAssets, allAssets, 'admin');

  const info = {
    commit: commit || 'unknown',
    buildTime,
    indexAsset,
    adminAsset,
    indexAssets,
    adminAssets,
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
