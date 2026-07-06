#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const defaultBootstrapDataOutFile = path.join(
  webDir,
  '.generated/bootstrap-data.json',
);

const MARKET_HOME_TOKEN_SEED_ENV_ORIGINS = {
  production: 'https://utility.onekeycn.com',
  test: 'https://utility.onekeytest.com',
};
const MARKET_HOME_TOKEN_SEED_QUERY = {
  networkId: '',
  sortBy: 'v24hUSD',
  sortType: 'desc',
  page: '1',
  limit: '20',
  minLiquidity: '5000',
  type: 'trending',
  timeFrame: '2',
  currency: 'usd',
};
const bootstrapDataOutFile = process.env.ONEKEY_BOOTSTRAP_DATA_OUT
  ? path.resolve(webDir, process.env.ONEKEY_BOOTSTRAP_DATA_OUT)
  : defaultBootstrapDataOutFile;
const seedRequired = process.env.MARKET_HOME_TOKEN_SEED_REQUIRED === '1';
const timeoutMs = Number(
  process.env.MARKET_HOME_TOKEN_SEED_TIMEOUT_MS || 30_000,
);
const minTokenCount = Number(
  process.env.MARKET_HOME_TOKEN_SEED_MIN_COUNT || 20,
);
const maxTokenCount = Number(
  process.env.MARKET_HOME_TOKEN_SEED_MAX_COUNT || 20,
);
const maxResponseBytes = Number(
  process.env.MARKET_HOME_TOKEN_SEED_MAX_RESPONSE_BYTES || 512_000,
);
const maxBootstrapDataBytes = Number(
  process.env.ONEKEY_BOOTSTRAP_DATA_MAX_BYTES || 96_000,
);

class MarketHomeTokenSeedError extends Error {}

const TOKEN_STRING_FIELDS = [
  'address',
  'chainId',
  'firstTradeTime',
  'liquidity',
  'logoUrl',
  'marketCap',
  'name',
  'networkId',
  'price',
  'price24hAgo',
  'priceChange24hPercent',
  'symbol',
  'trade24hCount',
  'buy24hCount',
  'sell24hCount',
  'uniqueWallet24h',
  'volume24h',
];

const TOKEN_NUMBER_FIELDS = ['decimals', 'holders'];
const TOKEN_BOOLEAN_FIELDS = ['communityRecognized', 'isNative'];
const STOCK_STRING_FIELDS = [
  'title',
  'subtitle',
  'source',
  'sourceLogoUri',
  'description',
  'dividendPerShare',
  'marketCap',
  'sharesOutstanding',
  'underlyingAssetTicker',
  'underlyingAssetName',
];
const STOCK_STRING_OBJECT_FIELDS = {
  assetAnalysis: ['volume24h'],
  tradingActivity: ['peRatio'],
};

function warnAndSkip(message) {
  console.warn(`[fetch-market-home-token-seed] skipped: ${message}`);
}

function removeGeneratedBootstrapData() {
  if (fs.existsSync(bootstrapDataOutFile)) {
    fs.rmSync(bootstrapDataOutFile);
  }
}

function createSeedUrl(origin) {
  const url = new URL('/utility/v2/market/token/list', origin);
  Object.entries(MARKET_HOME_TOKEN_SEED_QUERY).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return url.toString();
}

function resolveSeedUrl() {
  if (process.env.MARKET_HOME_TOKEN_SEED_URL) {
    return process.env.MARKET_HOME_TOKEN_SEED_URL;
  }

  const seedEnv = process.env.MARKET_HOME_TOKEN_SEED_ENV;
  if (!seedEnv) {
    return undefined;
  }

  const origin = MARKET_HOME_TOKEN_SEED_ENV_ORIGINS[seedEnv];
  if (!origin) {
    throw new MarketHomeTokenSeedError(
      [
        `Unsupported MARKET_HOME_TOKEN_SEED_ENV: ${seedEnv}.`,
        `Expected one of: ${Object.keys(
          MARKET_HOME_TOKEN_SEED_ENV_ORIGINS,
        ).join(', ')}.`,
      ].join(' '),
    );
  }
  return createSeedUrl(origin);
}

function getRequiredSeedUrl() {
  const seedUrl = resolveSeedUrl();
  if (seedUrl) {
    return seedUrl;
  }

  const message = [
    'MARKET_HOME_TOKEN_SEED_URL or MARKET_HOME_TOKEN_SEED_ENV is not set.',
    'Market home will fall back to the remote token list at runtime.',
  ].join(' ');
  if (seedRequired) {
    throw new MarketHomeTokenSeedError(message);
  }
  warnAndSkip(message);
  return undefined;
}

function getSeedData(payload) {
  if (Array.isArray(payload?.list)) {
    return payload;
  }
  if (Array.isArray(payload?.data?.list)) {
    return payload.data;
  }
  return null;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getSafeString(value, maxLength = 2048) {
  if (typeof value === 'string') {
    return value.slice(0, maxLength);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function assignStringField(target, source, key, maxLength) {
  const value = getSafeString(source[key], maxLength);
  if (value !== undefined) {
    target[key] = value;
  }
}

function assignNumberField(target, source, key) {
  const value = Number(source[key]);
  if (Number.isFinite(value)) {
    target[key] = value;
  }
}

function assignBooleanField(target, source, key) {
  if (typeof source[key] === 'boolean') {
    target[key] = source[key];
  }
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value
    .map((item) => getSafeString(item))
    .filter((item) => item !== undefined)
    .slice(0, 4);
  return result.length > 0 ? result : undefined;
}

function sanitizeStringObject(source, fields) {
  if (!isPlainObject(source)) {
    return undefined;
  }
  const result = {};
  fields.forEach((field) => assignStringField(result, source, field));
  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeStock(stock) {
  if (!isPlainObject(stock)) {
    return undefined;
  }

  const result = {};
  STOCK_STRING_FIELDS.forEach((field) =>
    assignStringField(result, stock, field),
  );
  if (typeof stock.isOpen === 'boolean') {
    result.isOpen = stock.isOpen;
  }
  Object.entries(STOCK_STRING_OBJECT_FIELDS).forEach(([field, fields]) => {
    const value = sanitizeStringObject(stock[field], fields);
    if (value) {
      result[field] = value;
    }
  });

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeTokenItem(item) {
  if (!isPlainObject(item)) {
    return undefined;
  }

  const result = {};
  TOKEN_STRING_FIELDS.forEach((field) =>
    assignStringField(result, item, field),
  );
  TOKEN_NUMBER_FIELDS.forEach((field) =>
    assignNumberField(result, item, field),
  );
  TOKEN_BOOLEAN_FIELDS.forEach((field) =>
    assignBooleanField(result, item, field),
  );

  const logoUrls = sanitizeStringArray(item.logoUrls);
  if (logoUrls) {
    result.logoUrls = logoUrls;
  }
  const stock = sanitizeStock(item.stock);
  if (stock) {
    result.stock = stock;
  }

  if (!result.name || !result.symbol || !result.networkId) {
    return undefined;
  }
  if (!Number.isFinite(result.decimals)) {
    return undefined;
  }

  return result;
}

function normalizeSeedPayload(payload) {
  const data = getSeedData(payload);

  if (!data) {
    throw new MarketHomeTokenSeedError(
      'Seed payload must contain list[] or data.list[].',
    );
  }

  if (data.list.length < minTokenCount) {
    throw new MarketHomeTokenSeedError(
      `Seed payload has ${data.list.length} token(s), expected at least ${minTokenCount}.`,
    );
  }

  const list = data.list
    .slice(0, maxTokenCount)
    .map((item) => sanitizeTokenItem(item))
    .filter(Boolean);

  if (list.length < minTokenCount) {
    throw new MarketHomeTokenSeedError(
      `Seed payload has ${list.length} valid token(s), expected at least ${minTokenCount}.`,
    );
  }

  const seed = {
    list,
    total: Number.isFinite(Number(data.total))
      ? Number(data.total)
      : list.length,
  };
  const generatedAt = getSafeString(data.generatedAt, 128);
  if (generatedAt) {
    seed.generatedAt = generatedAt;
  }
  return seed;
}

function getByteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function ensureByteLimit(label, bytes, maxBytes) {
  if (bytes > maxBytes) {
    throw new MarketHomeTokenSeedError(
      `${label} is ${bytes} bytes, expected at most ${maxBytes} bytes.`,
    );
  }
}

async function readResponseTextWithLimit(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 0) {
    ensureByteLimit(
      'Seed response content-length',
      contentLength,
      maxResponseBytes,
    );
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    ensureByteLimit(
      'Seed response body',
      getByteLength(text),
      maxResponseBytes,
    );
    return text;
  }

  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    receivedBytes += value.byteLength;
    ensureByteLimit('Seed response body', receivedBytes, maxResponseBytes);
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(bytes);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new MarketHomeTokenSeedError(
        `HTTP ${response.status} ${response.statusText}`,
      );
    }
    const text = await readResponseTextWithLimit(response);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function writeBootstrapData(seed) {
  const bootstrapData = {
    marketHomeTokenListSeed: seed,
  };
  fs.mkdirSync(path.dirname(bootstrapDataOutFile), { recursive: true });
  const bootstrapDataJson = JSON.stringify(bootstrapData, null, 2);
  ensureByteLimit(
    'Bootstrap data JSON',
    getByteLength(bootstrapDataJson),
    maxBootstrapDataBytes,
  );
  fs.writeFileSync(bootstrapDataOutFile, `${bootstrapDataJson}\n`);
}

async function main() {
  const seedUrl = getRequiredSeedUrl();
  if (!seedUrl) {
    removeGeneratedBootstrapData();
    return;
  }

  console.log(`Fetching market token seed: ${seedUrl}`);
  const payload = await fetchJson(seedUrl);
  const seed = normalizeSeedPayload(payload);

  writeBootstrapData(seed);

  console.log(
    [
      `Wrote bootstrap data to ${path.relative(webDir, bootstrapDataOutFile)}`,
      `(${seed.list.length} token(s)${
        seed.generatedAt ? `, generatedAt=${seed.generatedAt}` : ''
      })`,
    ].join(' '),
  );
}

main().catch((error) => {
  removeGeneratedBootstrapData();
  const message = error instanceof Error ? error.message : String(error);
  if (seedRequired) {
    console.error(`[fetch-market-home-token-seed] failed: ${message}`);
    process.exitCode = 1;
    return;
  }
  warnAndSkip(message);
});
