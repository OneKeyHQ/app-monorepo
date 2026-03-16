#!/usr/bin/env node

/**
 * Add a new translation key to Lokalise
 * Usage: yarn i18n:add <key> "<en_value>" ["<zh_value>"]
 *
 * Environment variables (injected by 1Password CLI via `yarn op`):
 *   LOKALISE_TOKEN - Lokalise API token
 *   LOKALISE_PROJECT_ID - Lokalise project ID
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LOCALE_JSON_PATH = path.join(
  __dirname,
  '../../../packages/shared/src/locale/json/en_US.json',
);

// 4 semantic type suffixes for new translation keys (format: semantic_key__type)
const TYPE_SUFFIXES = {
  title: { case: 'Title Case', desc: 'title, form label, short label' },
  action: { case: 'Title Case', desc: 'button, menu item, tab, option, link' },
  desc: {
    case: 'Sentence case',
    desc: 'description, placeholder, hint, help text, empty state',
  },
  msg: {
    case: 'Sentence case',
    desc: 'error, toast, success/warning message, alert',
  },
};

function getEnvVar(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} environment variable is required`);
    console.error('\nRun via `yarn op` to inject secrets from 1Password:');
    console.error(`  yarn i18n:add <key> "<value>"`);
    process.exit(1);
  }
  return value;
}

function detectTypeSuffix(key) {
  const match = key.match(/__([a-z]+)$/);
  if (match) {
    const suffix = match[1];
    if (TYPE_SUFFIXES[suffix]) {
      return suffix;
    }
  }
  return null;
}

function printTypeInfo(key) {
  const type = detectTypeSuffix(key);
  if (type) {
    const info = TYPE_SUFFIXES[type];
    console.log(`  Type: __${type} (${info.desc})`);
    console.log(`  Case: ${info.case}`);
  } else {
    console.log('\x1b[33m  Warning: No type suffix detected.\x1b[0m');
    console.log('  Recommended suffixes for new keys:');
    for (const [suffix, info] of Object.entries(TYPE_SUFFIXES)) {
      console.log(`    __${suffix}  → ${info.case} (${info.desc})`);
    }
  }
}

function extractPlaceholders(text) {
  // Parse top-level ICU placeholders only, skipping nested literal blocks.
  // Supports real Lokalise patterns:
  //   {name}           — standard ICU variable
  //   {count, plural}  — ICU plural/select (extracts "count")
  //   {0}, {1}         — positional placeholders
  //   { token }        — spaced placeholder
  //   {Device Name}    — multi-word placeholder
  // Also handles ICU escape: '{literal}' is not a placeholder
  const names = [];
  let depth = 0;
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    // ICU uses single-quote to escape: '{ }' is literal, '' is a literal '
    if (ch === "'") {
      if (text[i + 1] === "'") {
        i += 2; // '' → literal single quote, skip both
      } else {
        quoted = !quoted;
        i += 1;
      }
    } else if (quoted) {
      i += 1;
    } else {
      if (ch === '{') {
        if (depth === 0) {
          // Top-level opening brace — extract placeholder name up to , or }
          const rest = text.slice(i + 1);
          const match = rest.match(/^\s*(.+?)\s*[,}]/);
          if (match && match[1] !== '#') {
            names.push(match[1]);
          }
        }
        depth += 1;
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
      i += 1;
    }
  }
  return [...new Set(names)].toSorted();
}

function validatePlaceholders(enValue, zhValue) {
  const enPlaceholders = extractPlaceholders(enValue);
  const zhPlaceholders = extractPlaceholders(zhValue);

  const enSet = enPlaceholders.join(',');
  const zhSet = zhPlaceholders.join(',');

  if (enSet !== zhSet) {
    const enOnly = enPlaceholders.filter((p) => !zhPlaceholders.includes(p));
    const zhOnly = zhPlaceholders.filter((p) => !enPlaceholders.includes(p));

    console.error('Error: Placeholder mismatch between en and zh translations');
    console.error(`  English placeholders: {${enPlaceholders.join('}, {')}}`);
    console.error(`  Chinese placeholders: {${zhPlaceholders.join('}, {')}}`);
    if (enOnly.length) {
      console.error(`  Missing in zh: {${enOnly.join('}, {')}}`);
    }
    if (zhOnly.length) {
      console.error(`  Missing in en: {${zhOnly.join('}, {')}}`);
    }
    process.exit(1);
  }
}

function validateKey(key) {
  // Allow lowercase letters, numbers, underscores (including __ for type suffix)
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    console.error('Error: Invalid key format');
    console.error('Key must:');
    console.error('  - Start with lowercase letter');
    console.error(
      '  - Contain only lowercase letters, numbers, and underscores',
    );
    console.error(
      '  - Example: send__title, confirm__action, transaction_failed__msg',
    );
    process.exit(1);
  }

  // Check if key already exists
  const translations = JSON.parse(fs.readFileSync(LOCALE_JSON_PATH, 'utf-8'));
  if (key in translations) {
    console.error(`Error: Key "${key}" already exists`);
    console.error(`  Current value: "${translations[key]}"`);
    console.error('\nUse a different key name or reuse the existing one.');
    process.exit(1);
  }
}

function addToLokalise(key, enValue, zhValue) {
  return new Promise((resolve, reject) => {
    const token = getEnvVar('LOKALISE_TOKEN');
    const projectId = getEnvVar('LOKALISE_PROJECT_ID');

    const translations = [
      {
        language_iso: 'en_US',
        translation: enValue,
      },
    ];

    if (zhValue) {
      translations.push({
        language_iso: 'zh_CN',
        translation: zhValue,
      });
    }

    const data = JSON.stringify({
      keys: [
        {
          key_name: key,
          platforms: ['web'],
          translations,
        },
      ],
    });

    const options = {
      hostname: 'api.lokalise.com',
      port: 443,
      path: `/api2/projects/${projectId}/keys`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': token,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(JSON.parse(body));
          } else {
            reject(
              new Error(`Lokalise API error: ${res.statusCode} - ${body}`),
            );
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const key = process.argv[2];
  const enValue = process.argv[3];
  const zhValue = process.argv[4];

  if (!key || !enValue) {
    console.error('Usage: yarn i18n:add <key> "<en_value>" ["<zh_value>"]');
    console.error('');
    console.error('Examples:');
    console.error('  yarn i18n:add send__title "Send"');
    console.error('  yarn i18n:add confirm__action "Confirm"');
    console.error(
      '  yarn i18n:add enter_send_amount__desc "Enter the amount you want to send"',
    );
    console.error(
      '  yarn i18n:add send_amount__msg "Send {amount} {symbol}" "发送 {amount} {symbol}"',
    );
    console.error('');
    console.error('Type suffixes: __title, __action, __desc, __msg');
    console.error(
      'Placeholders: use {name} — validated across en/zh when both provided',
    );
    process.exit(1);
  }

  console.log(`Adding translation key: ${key}`);
  console.log(`English: "${enValue}"`);
  if (zhValue) {
    console.log(`Chinese: "${zhValue}"`);
  }
  printTypeInfo(key);

  // Show detected placeholders
  const placeholders = extractPlaceholders(enValue);
  if (placeholders.length) {
    console.log(`  Placeholders: {${placeholders.join('}, {')}}`);
  }
  console.log('');

  // Validate
  validateKey(key);
  if (zhValue) {
    validatePlaceholders(enValue, zhValue);
  }

  // Add to Lokalise
  try {
    console.log('Adding to Lokalise...');
    await addToLokalise(key, enValue, zhValue);
    console.log('Added to Lokalise');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: yarn i18n:pull');
    console.log(`  2. Use in code: ETranslations.${key.replace(/\./g, '_')}`);
    console.log('');
  } catch (error) {
    console.error('Failed to add to Lokalise:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message || error);
  process.exit(1);
});
