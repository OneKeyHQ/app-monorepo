#!/usr/bin/env node

/**
 * Clear profiler logs (heartbeat/functions) from the iOS simulator container.
 *
 * Usage:
 *   node development/scripts/clear-rn-profiler-logs.js
 *   RN_PROFILER_BUNDLE_ID=your.bundle.id node development/scripts/clear-rn-profiler-logs.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = process.env.RN_PROFILER_BUNDLE_ID || 'so.onekey.wallet';
const LOG_FILES = [
  'rn-profiler/heartbeat.log',
  'rn-profiler/functions.log',
];

function getAppContainer() {
  return execSync(`xcrun simctl get_app_container booted ${BUNDLE_ID} data`, {
    encoding: 'utf8',
  }).trim();
}

function main() {
  const container = getAppContainer();
  const docsDir = path.join(container, 'Documents');
  let cleared = 0;
  LOG_FILES.forEach((rel) => {
    const target = path.join(docsDir, rel);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      cleared += 1;
      // eslint-disable-next-line no-console
      console.log(`Removed ${target}`);
    }
  });
  if (!cleared) {
    // eslint-disable-next-line no-console
    console.log('No profiler logs found to remove.');
  }
}

main();
