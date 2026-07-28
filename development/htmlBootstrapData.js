const fs = require('fs');
const path = require('path');

const ONEKEY_BOOTSTRAP_DATA_GLOBAL = '__ONEKEY_BOOTSTRAP_DATA__';
const maxBootstrapDataBytes = Number(
  process.env.ONEKEY_BOOTSTRAP_DATA_MAX_BYTES || 96_000,
);
const bootstrapDataRequired =
  process.env.ONEKEY_BOOTSTRAP_DATA_REQUIRED === '1' ||
  process.env.MARKET_HOME_TOKEN_SEED_REQUIRED === '1';

function escapeInlineScriptJson(json) {
  return json
    .replace(/</g, '\\u003C')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function getBootstrapDataFile(basePath) {
  return process.env.ONEKEY_BOOTSTRAP_DATA_OUT
    ? path.resolve(basePath, process.env.ONEKEY_BOOTSTRAP_DATA_OUT)
    : path.join(basePath, '.generated/bootstrap-data.json');
}

function readOneKeyBootstrapDataCode({ basePath, platform, isDev }) {
  if (platform !== 'web' || isDev || process.env.NODE_ENV !== 'production') {
    return '';
  }

  const bootstrapDataFile = getBootstrapDataFile(basePath);
  if (!fs.existsSync(bootstrapDataFile)) {
    if (bootstrapDataRequired) {
      throw new Error(
        `OneKey bootstrap data file is missing: ${bootstrapDataFile}`,
      );
    }
    return '';
  }

  const raw = fs.readFileSync(bootstrapDataFile, 'utf8');
  const rawBytes = Buffer.byteLength(raw, 'utf8');
  if (rawBytes > maxBootstrapDataBytes) {
    throw new Error(
      `OneKey bootstrap data is ${rawBytes} bytes, expected at most ${maxBootstrapDataBytes} bytes.`,
    );
  }
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return '';
  }

  const escapedDataJsonLiteral = escapeInlineScriptJson(
    JSON.stringify(JSON.stringify(data)),
  );
  return [
    '(function(g){',
    `g.${ONEKEY_BOOTSTRAP_DATA_GLOBAL}=JSON.parse(`,
    escapedDataJsonLiteral,
    ');',
    "})(typeof globalThis==='object'?globalThis:window);",
  ].join('');
}

module.exports = {
  ONEKEY_BOOTSTRAP_DATA_GLOBAL,
  readOneKeyBootstrapDataCode,
};
