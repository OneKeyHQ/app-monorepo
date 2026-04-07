const fs = require('fs');
const path = require('path');

const dateFns = require('date-fns');
const dotenv = require('dotenv');

const envPaths = [
  // priority: high -> low
  path.resolve(__dirname, '../.env.version'),
  path.resolve(__dirname, '../.env.expo'),
  path.resolve(__dirname, '../.env'),
].filter((p) => fs.existsSync(p));

const results = [
  dotenv.config({
    path: envPaths,
  }),
];

if (process.env.NODE_ENV !== 'production') {
  // console.log('process.env', process.env);

  process.env.BUILD_NUMBER =
    process.env.BUILD_NUMBER ||
    `10${dateFns.format(Date.now(), 'yyMMdd')}00`;

  // Generate BUNDLE_VERSION: seconds since 2026-01-01T00:00:00Z
  const EPOCH_2026 = new Date('2026-01-01T00:00:00Z').getTime();
  const NOW = Date.now();
  const bundleVersion = Math.floor((NOW - EPOCH_2026) / 1000);
  process.env.BUNDLE_VERSION = process.env.BUNDLE_VERSION || String(bundleVersion);
}

process.env.BUILD_TIME = Date.now();

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
