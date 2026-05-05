#!/usr/bin/env node

/**
 * Search for existing translation keys
 * Usage: node i18n-search.js <keyword>
 */

const fs = require('fs');
const path = require('path');

const LOCALE_JSON_PATH = path.join(
  __dirname,
  '../../../packages/shared/src/locale/json/en_US.json',
);

// 4 semantic type suffixes (format: semantic_key__type)
const TYPE_SUFFIXES = {
  title: 'Title Case',
  action: 'Title Case',
  desc: 'Sentence case',
  msg: 'Sentence case',
};

function loadTranslations() {
  const content = fs.readFileSync(LOCALE_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

function detectTypeSuffix(key) {
  const match = key.match(/__([a-z]+)$/);
  if (match && TYPE_SUFFIXES[match[1]]) {
    return match[1];
  }
  return null;
}

function formatTypeTag(key) {
  const type = detectTypeSuffix(key);
  if (type) {
    return `[${type}]`;
  }
  return '';
}

function search(keyword) {
  if (!keyword) {
    console.error('Usage: yarn i18n:search <keyword>');
    process.exit(1);
  }

  const translations = loadTranslations();
  const lowerKeyword = keyword.toLowerCase();
  const results = [];

  for (const [key, value] of Object.entries(translations)) {
    const lowerKey = key.toLowerCase();
    const lowerValue = String(value).toLowerCase();

    if (lowerKey.includes(lowerKeyword) || lowerValue.includes(lowerKeyword)) {
      results.push({ key, value });
    }
  }

  if (results.length === 0) {
    console.log(`No results found for "${keyword}"`);
    console.log('\nTip: Try a different keyword or add a new key with:');
    console.log(`  yarn i18n:add ${keyword}__title "<value>"`);
    return;
  }

  console.log(`Found ${results.length} results for "${keyword}":\n`);

  // Group by semantic prefix (part before __ or first segment)
  const grouped = {};
  for (const { key, value } of results) {
    const prefix = key.includes('__')
      ? key.split('__')[0]
      : key.split(/[._]/)[0];
    if (!grouped[prefix]) {
      grouped[prefix] = [];
    }
    grouped[prefix].push({ key, value });
  }

  for (const [prefix, items] of Object.entries(grouped)) {
    console.log(`[${prefix}]`);
    for (const { key, value } of items) {
      const displayValue =
        value.length > 50 ? `${value.substring(0, 47)}...` : value;
      const typeTag = formatTypeTag(key);
      console.log(`  ${key}${typeTag ? ` ${typeTag}` : ''}`);
      console.log(`    → "${displayValue}"`);
    }
    console.log('');
  }

  // Show type distribution summary
  let typed = 0;
  let untyped = 0;
  for (const { key } of results) {
    if (detectTypeSuffix(key)) {
      typed += 1;
    } else {
      untyped += 1;
    }
  }

  console.log(
    `Total: ${results.length} keys (${typed} typed, ${untyped} legacy)`,
  );
}

const keyword = process.argv[2];
search(keyword);
