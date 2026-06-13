#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function pbkdf2Hash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`pbkdf2:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

async function promptHidden(promptText) {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    // hide input
    stdin.resume();
    stdin.setRawMode && stdin.setRawMode(true);
    process.stdout.write(promptText);
    let input = '';
    stdin.on('data', (ch) => {
      const char = ch.toString();
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        stdin.setRawMode && stdin.setRawMode(false);
        rl.close();
        resolve(input);
        return;
      }
      if (char === '\u0003') { // ctrl-c
        process.exit();
      }
      input += char;
    });
  });
}

async function main() {
  try {
    const password = await promptHidden('Enter admin password (input hidden): ');
    if (!password || password.length === 0) {
      console.error('Empty password, aborting.');
      process.exit(1);
    }

    const salt = crypto.randomBytes(16);
    const hash = await pbkdf2Hash(password, salt);
    const sessionSecret = crypto.randomBytes(32).toString('hex');

    const out = [];
    out.push('# Local admin env (DO NOT COMMIT)');
    out.push(`# Generated: ${new Date().toISOString()}`);
    out.push('');
    out.push('# Set the following in your local .env (example)');
    out.push('# ADMIN_LOGIN_EMAIL=your_admin_email@example.com');
    out.push(`ADMIN_PASSWORD_HASH=${hash}`);
    out.push(`ADMIN_SESSION_SECRET=${sessionSecret}`);
    out.push('PORT=3001');

    const outPath = path.join(__dirname, '..', '.env.local.admin');
    fs.writeFileSync(outPath, out.join('\n'), { mode: 0o600 });
    console.log(`Wrote local admin env file: ${outPath}`);
    console.log('IMPORTANT: Do NOT commit this file. Use it for local testing only.');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
