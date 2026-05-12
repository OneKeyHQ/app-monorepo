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
    process.env.BUILD_NUMBER || `${dateFns.format(Date.now(), 'MMddHHmm')}-dev`;
  // Sentinel high enough to never be exceeded by a real CI-computed
  // BUNDLE_VERSION (which is "seconds since 2026-01-01"; ~99M ≈ year 2029).
  // Picking a value above real bundles keeps dev clients from prompting hot
  // updates AND makes dev/QA traffic identifiable as exactly 99999999 in
  // Mixpanel — distinct from the iOS Info.plist sentinel (0) and the
  // historical 1000000 placeholder that polluted numeric buckets.
  process.env.BUNDLE_VERSION = process.env.BUNDLE_VERSION || '99999999';
}

process.env.BUILD_TIME = Date.now();

const errorResult = results.find((result) => result.error);

if (errorResult) {
  throw errorResult.error;
}
