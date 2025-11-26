#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = process.env.RN_PROFILER_BUNDLE_ID || 'so.onekey.wallet';
const LOG_FILES = [
  'rn-profiler/heartbeat.log',
  'rn-profiler/functions.log',
];
const OUTPUT_DIR = path.join(__dirname, '../output');

function getAppContainer() {
  const result = execSync(
    `xcrun simctl get_app_container booted ${BUNDLE_ID} data`,
    { encoding: 'utf8' },
  );
  return result.trim();
}

function main() {
  const container = getAppContainer();
  const targetDir = path.join(OUTPUT_DIR, 'profiler');
  fs.mkdirSync(targetDir, { recursive: true });
  LOG_FILES.forEach((rel) => {
    const source = path.join(container, 'Documents', rel);
    if (!fs.existsSync(source)) {
      // eslint-disable-next-line no-console
      console.warn(`Log not found at ${source}, skip.`);
      return;
    }
    const target = path.join(targetDir, path.basename(rel));
    fs.copyFileSync(source, target);
    const { size } = fs.statSync(target);
    // eslint-disable-next-line no-console
    console.log(
      `Log copied to ${target} (${(size / 1024).toFixed(1)} KB).`,
    );
  });
}

main();
