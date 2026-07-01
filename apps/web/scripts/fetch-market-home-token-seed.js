#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const webDir = path.resolve(__dirname, '..');
const outFile =
  process.env.MARKET_HOME_TOKEN_SEED_OUT ||
  path.join(webDir, 'web-build', 'static', 'market-home-token-seed-v1.json');
const seedUrl = process.env.MARKET_HOME_TOKEN_SEED_URL;
const timeoutMs = Number(
  process.env.MARKET_HOME_TOKEN_SEED_TIMEOUT_MS || 30_000,
);
const minTokenCount = Number(
  process.env.MARKET_HOME_TOKEN_SEED_MIN_COUNT || 20,
);

class MarketHomeTokenSeedError extends Error {}

function requireSeedUrl() {
  if (!seedUrl) {
    throw new MarketHomeTokenSeedError(
      [
        'MARKET_HOME_TOKEN_SEED_URL is required.',
        'Upload the generated market-home-token-seed-v1.json to a static URL,',
        'then pass that URL when building @onekeyhq/web.',
      ].join(' '),
    );
  }
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

  return {
    list: data.list,
    total: Number.isFinite(Number(data.total))
      ? Number(data.total)
      : data.list.length,
    generatedAt: data.generatedAt || new Date().toISOString(),
  };
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
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  requireSeedUrl();

  console.log(`Fetching market token seed: ${seedUrl}`);
  const payload = await fetchJson(seedUrl);
  const seed = normalizeSeedPayload(payload);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(seed)}\n`);

  console.log(
    `Wrote ${path.relative(webDir, outFile)} (${seed.list.length} token(s), generatedAt=${seed.generatedAt})`,
  );
}

main().catch((error) => {
  console.error('[fetch-market-home-token-seed] failed:', error);
  process.exit(1);
});
