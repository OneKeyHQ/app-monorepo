#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  computeSessionDerived,
  computeSessionLowFpsHotspots,
  computeSessionJsBlockHotspots,
  computeSessionKeyMarks,
  computeSessionSpanHotspots,
} = require('../derived');
const storage = require('../storage');

function usage() {
  const cmd = path.relative(process.cwd(), __filename);
  console.log(
    [
      'Derive slow-functions / repeated-calls for a sessionId.',
      '',
      `Usage:`,
      `  node ${cmd} <sessionId> [--output out.json] [--pretty] [--topSlow 50] [--topRepeated 50] [--fpsThreshold 10] [--fpsTopWindows 10] [--fpsTopFunctions 25] [--noFps] [--noJsblock]`,
      '',
      `Defaults:`,
      `  PERF_OUTPUT_DIR=${storage.OUTPUT_DIR}`,
    ].join('\n'),
  );
}

function pickArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function clampInt(n, min, max, fallback) {
  if (n === null || n === undefined || n === '') return fallback;
  const num = Number(n);
  if (!Number.isFinite(num)) return fallback;
  const int = Math.trunc(num);
  return Math.min(Math.max(int, min), max);
}

async function main() {
  const sessionId = process.argv.slice(2).find((a) => a && !a.startsWith('-'));
  if (hasFlag('--help') || hasFlag('-h')) {
    usage();
    process.exit(0);
  }
  if (!sessionId) {
    usage();
    process.exit(1);
  }

  const outPath = pickArg('--output');
  const pretty = hasFlag('--pretty');
  const topSlow = clampInt(pickArg('--topSlow'), 1, 5000, 50);
  const topRepeated = clampInt(pickArg('--topRepeated'), 1, 5000, 50);
  const noFps = hasFlag('--noFps') || hasFlag('--no-fps');
  const noJsblock = hasFlag('--noJsblock') || hasFlag('--no-jsblock');
  const fpsThreshold = noFps
    ? null
    : clampInt(pickArg('--fpsThreshold'), 1, 240, 10);
  const fpsTopWindows = clampInt(pickArg('--fpsTopWindows'), 1, 50, 10);
  const fpsTopFunctions = clampInt(pickArg('--fpsTopFunctions'), 1, 100, 25);

  const derived = computeSessionDerived(sessionId);
  if (!derived) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(2);
  }

  if (derived.entries.length > 0) {
    const missingTs = derived.entries.filter(
      (e) => !Number.isFinite(e.ts) || e.ts <= 0,
    ).length;
    const ratio = missingTs / derived.entries.length;
    if (ratio > 0.3) {
      console.error(
        `[warn] ${Math.round(
          ratio * 100,
        )}% entries missing timestamp; repeated-calls may be unreliable (need timestamp/absoluteTime/ts).`,
      );
    }
  }

  const lowFps =
    fpsThreshold === null || fpsThreshold === undefined
      ? null
      : computeSessionLowFpsHotspots(sessionId, {
          thresholdFps: fpsThreshold,
          topWindows: fpsTopWindows,
          topFunctions: fpsTopFunctions,
        });

  const jsblock = noJsblock
    ? null
    : computeSessionJsBlockHotspots(sessionId, {
        topWindows: fpsTopWindows,
        topFunctions: fpsTopFunctions,
      });

  const keyMarks = computeSessionKeyMarks(sessionId, {
    names: [
      // App start (baseline for all timing calculations)
      'app:start',
      // Home refresh KPI
      'Home:refresh:start:tokens',
      'Home:refresh:done:tokens',
      'Home:done:tokens',
      // Home lifecycle (helps explain missing/delayed refresh start marks)
      'Home:overview:mount',
      'Home:overview:unmount',
      'Home:tabs:containerKey:init',
      'Home:tabs:containerKey:change',
      // Deferred tasks
      'Home:approvals:fetch:start',
      'Home:approvals:fetch:done',
      // Tokens all-network rawData (helps explain refresh start delays)
      'Home:tokens:allnet:rawData:start',
      'Home:tokens:allnet:rawData:done',
      // Tokens onStarted / rawData pipeline (helps explain getAllAccounts->requests gap)
      'Home:tokens:onStarted:start',
      'Home:tokens:onStarted:rawData:start',
      'Home:tokens:onStarted:rawData:done',
      'Home:tokens:onStarted:done',
      'Home:tokens:rawData:prefetch:start',
      'Home:tokens:rawData:prefetch:done',
      'Home:tokens:rawData:load:start',
      'Home:tokens:rawData:load:done',
      'Home:tokens:rawData:customTokens:done',
      'Home:tokens:rawData:riskTokenManagement:done',
      'Home:tokens:rawData:localTokens:done',
      'Home:tokens:rawData:aggregateToken:done',
      'Home:tokens:walletConfigSync:start',
      'Home:tokens:walletConfigSync:done',
      // BTC fresh address (helps confirm it's moved out of refresh window)
      'Home:btcFreshAddress:sync:scheduled',
      'Home:btcFreshAddress:sync:start',
      'Home:btcFreshAddress:sync:done',
      // DeFi all-network (helps confirm it's moved out of refresh window)
      'Home:defi:allnet:fetch:start',
      'Home:defi:allnet:fetch:done',
      'Home:defi:allnet:rawData:start',
      'Home:defi:allnet:rawData:done',
      // Non-critical tasks we want to keep out of refresh window
      'Home:defi:fetch:start',
      'Home:defi:fetch:done',
      'Home:defi:allnet:fetch:start',
      'Home:defi:allnet:fetch:done',
      'Bootstrap:fetchCurrencyList:start',
      'Bootstrap:fetchCurrencyList:done',
      'Bootstrap:marketBasicConfig:start',
      'Bootstrap:marketBasicConfig:done',
      'Bootstrap:perpsConfig:update:start',
      'Bootstrap:perpsConfig:update:done',
      'Bootstrap:appUpdate:autoCheck:start',
      'Bootstrap:appUpdate:autoCheck:done',
      'Home:perpsConfig:update:start',
      'Home:perpsConfig:update:done',
      // All-Network phases (help explain refresh start delays / jsblock)
      'AllNet:useAllNetworkRequests:start',
      // Start these early to "pipeline" the critical path (cold start)
      'AllNet:getAllNetworkAccounts:prefetch:start',
      'AllNet:getAllNetworkAccounts:prefetch:done',
      'AllNet:getAllNetworkAccounts:start',
      'AllNet:getAllNetworkAccounts:done',
      'AllNet:tokens:onStarted:start',
      'AllNet:tokens:onStarted:afterGetRawData',
      'AllNet:tokens:onStarted:afterWalletConfigSync',
      'AllNet:cacheRequests:start',
      'AllNet:cacheRequests:done',
      'AllNet:cacheData:start',
      'AllNet:cacheData:done',
      'AllNet:requests:start',
      'AllNet:requests:done',
      // Per-network request timings (helps pinpoint outliers)
      'AllNet:request:start',
      'AllNet:request:done',
      'AllNet:request:timeout',
      'AllNet:request:lateDone',
      'AllNet:indexedRequests:start',
      'AllNet:indexedRequests:done',
      'AllNet:notIndexedRequests:start',
      'AllNet:notIndexedRequests:done',
      // Per-network fetchAccountTokens stage (helps split "network wait" vs "sync CPU/GC")
      'Token:fetchAccountTokens:done',
      // Post-fetch processing on UI thread (helps attribute jsblock to merge/aggregate work)
      'Home:tokens:postFetch:start',
      'Home:tokens:postFetch:done',
      'Home:tokens:aggregateBuild:start',
      'Home:tokens:aggregateBuild:done',
      'Home:tokens:mergeAllTokens:start',
      'Home:tokens:mergeAllTokens:done',
    ],
  });

  const homeRefreshTokens = (() => {
    const sessionStart = Number(keyMarks?.sessionStart);
    const start = keyMarks?.marks?.['Home:refresh:start:tokens']?.first?.t;
    const end = keyMarks?.marks?.['Home:refresh:done:tokens']?.first?.t;
    if (
      !Number.isFinite(sessionStart) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start
    ) {
      return null;
    }
    const span = computeSessionSpanHotspots(sessionId, {
      start,
      end,
      topFunctions: fpsTopFunctions,
    });
    if (!span) return null;
    return {
      ...span,
      startSinceSessionStartMs: start - sessionStart,
      endSinceSessionStartMs: end - sessionStart,
    };
  })();

  const payload = {
    sessionId: derived.sessionId,
    meta: derived.meta || null,
    timeRange: derived.timeRange,
    modules: derived.modules,
    keyMarks,
    homeRefreshTokens,
    totals: {
      entries: derived.entries.length,
      slowFunctions: derived.slowFunctions.length,
      repeatedCallsRapid: derived.repeatedCalls.length,
      repeatedCallsOverall: derived.repeatedCallsOverall.length,
    },
    lowFps,
    jsblock,
    slowFunctions: derived.slowFunctions.slice(0, topSlow),
    repeatedCalls: derived.repeatedCalls.slice(0, topRepeated),
    repeatedCallsOverall: derived.repeatedCallsOverall.slice(0, topRepeated),
  };

  const json = JSON.stringify(payload, null, pretty ? 2 : 0);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${json}\n`, 'utf8');
    console.log(outPath);
    return;
  }
  process.stdout.write(`${json}\n`);
}

main().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
