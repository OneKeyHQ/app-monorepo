#!/usr/bin/env bash
set -euo pipefail

SERVICE_DATA_FILE="${BOT_WALLET_KEY_API_DATA_FILE:-}"
SERVICE_SRC_DIR="${BOT_WALLET_KEY_API_SRC_DIR:-}"
VAULT_FILE="${BOT_WALLET_VAULT_FILE:-$HOME/.onekey-cli/bot-wallet/vault.enc}"

FORBIDDEN_VAULT_PATTERN='accessToken|ciphertextBase64|ciphertext|mnemonic|seedPhrase|displayAddress|walletId|sourceLabel|IBip39RevealableSeed'

status=0

run_step() {
  local label="$1"
  shift

  if ! "$@"; then
    status=1
  fi
}

audit_keys_json() {
  if [[ ! -f "$SERVICE_DATA_FILE" ]]; then
    return 0
  fi

  SERVICE_DATA_FILE="$SERVICE_DATA_FILE" node <<'NODE'
const fs = require('node:fs');

const file = process.env.SERVICE_DATA_FILE;
const allowed = new Set([
  'keyBase64',
  'accessTokenSha256',
  'createdAt',
  'revokedAt',
]);

const raw = fs.readFileSync(file, 'utf8').trim();
if (raw.length === 0) {
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error(`Step1 keys.json parse failed: ${file}: ${error.message}`);
  process.exit(1);
}

if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
  console.error(`Step1 keys.json must be an object map: ${file}`);
  process.exit(1);
}

const violations = [];
for (const [keyId, record] of Object.entries(parsed)) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    violations.push(`${keyId}: <non-object record>`);
    continue;
  }

  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      violations.push(`${keyId}.${field}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Step1 keys.json forbidden persisted fields:');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
NODE
}

audit_service_source() {
  if [[ ! -d "$SERVICE_SRC_DIR" ]]; then
    return 0
  fi

  SERVICE_SRC_DIR="$SERVICE_SRC_DIR" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const srcDir = process.env.SERVICE_SRC_DIR;
const forbidden = [
  'accessToken',
  'ciphertextBase64',
  'ciphertext',
  'mnemonic',
  'seedPhrase',
  'IBip39RevealableSeed',
  'walletId',
  'displayAddress',
  'sourceLabel',
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.yarn') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else if (/\.[cm]?[jt]s$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const violations = [];
for (const file of walk(srcDir)) {
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const field of forbidden) {
      const pattern = new RegExp(`(['"\`])?${field}\\1?\\s*:`);
      if (pattern.test(line)) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Step2 service source writes forbidden persistence fields:');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
NODE
}

audit_vault_raw() {
  if [[ ! -f "$VAULT_FILE" ]]; then
    return 0
  fi

  if LC_ALL=C grep -a -E -n "$FORBIDDEN_VAULT_PATTERN" "$VAULT_FILE" >&2; then
    printf 'Step3 vault.enc raw bytes contain forbidden field names: %s\n' "$VAULT_FILE" >&2
    return 1
  fi

  return 0
}

run_step "keys.json whitelist" audit_keys_json
run_step "service source whitelist" audit_service_source
run_step "vault raw grep" audit_vault_raw

exit "$status"
