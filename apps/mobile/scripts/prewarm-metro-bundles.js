#!/usr/bin/env node
/* eslint-disable no-console */
// Warm Metro's cache for the background bundle before the app asks for it.
//
// In dev the background runtime fetches /background.bundle from Metro, which
// compiles it ON DEMAND: measured at 65s warm and several minutes on a cold
// cache, for ~100MB of output. The app gives up long before that and reports
// "Background runtime ready timeout" -- with every background service (network
// list, vaults, schedulers) living in that runtime, the app then comes up
// looking completely broken.
//
// Native builds take minutes anyway, so this is free time: start it next to
// Metro and the bundle is ready before the APK finishes installing.
//
//   node apps/mobile/scripts/prewarm-metro-bundles.js [--platform android|ios|all] [--host localhost:8081]

const http = require('node:http');

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const host = argValue('--host', 'localhost:8081');
const platformArg = argValue('--platform', 'all');
const platforms = platformArg === 'all' ? ['android', 'ios'] : [platformArg];

// Must match the URLs the native side requests, or Metro treats it as a
// different build and the warm-up is wasted work: see
// android/app/.../MainApplication.java and ios/AppDelegate.swift for the
// background entry, and the dev-client request in Android device logs for the
// main one.
function backgroundBundleUrl(platform) {
  return `http://${host}/background.bundle?platform=${platform}&dev=true&lazy=false&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true`;
}

// The app is unusable until BOTH graphs exist: main renders nothing without
// its own bundle, and every background service lives in the other one.
function mainBundleUrl(platform) {
  return (
    `http://${host}/apps/mobile/index.bundle//&platform=${platform}` +
    `&dev=true&lazy=false&minify=false&app=so.onekey.app.wallet` +
    `&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server` +
    `&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1` +
    `&unstable_transformProfile=hermes-stable&resolver.runtimeTarget=main`
  );
}

function get(url, { discardBody = true } = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const req = http.get(url, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        // Never buffer ~100MB just to throw it away.
        if (!discardBody) {
          throw new TypeError('Response body buffering is not supported');
        }
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          bytes,
          ms: Date.now() - startedAt,
        }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

const METRO_WAIT_MS = 2 * 60 * 1000;

async function waitForMetro(timeoutMs = METRO_WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  for (;;) {
    try {
      const res = await get(`http://${host}/status`);
      if (res.status === 200) {
        return true;
      }
    } catch (_e) {
      // not up yet
    }
    if (Date.now() > deadline) {
      return false;
    }
    if (!announced) {
      console.log(`[prewarm] waiting for Metro on ${host} ...`);
      announced = true;
    }
    await new Promise((r) => {
      setTimeout(r, 1000);
    });
  }
}

async function warmOne({ platform, name, url }) {
  console.log(`[prewarm] building ${name} for ${platform} ...`);
  try {
    const { status, bytes, ms } = await get(url);
    const mb = (bytes / 1024 / 1024).toFixed(1);
    if (status === 200) {
      console.log(
        `[prewarm] ${platform} ${name}: ready in ${(ms / 1000).toFixed(
          1,
        )}s (${mb} MB)`,
      );
      return;
    }
    console.error(
      `[prewarm] ${platform} ${name}: HTTP ${status} after ${ms}ms`,
    );
    process.exitCode = 1;
  } catch (e) {
    console.error(
      `[prewarm] ${platform} ${name}: failed`,
      (e && e.message) || e,
    );
    process.exitCode = 1;
  }
}

async function main() {
  if (!(await waitForMetro())) {
    console.error(
      `[prewarm] Metro never answered on ${host}; start it with "yarn native-bundle" first.`,
    );
    process.exitCode = 1;
    return;
  }
  // Sequential on purpose: two full bundle builds at once just thrash CPU and
  // make both slower. Main first -- nothing renders without it.
  const targets = platforms.flatMap((platform) => [
    { platform, name: 'index.bundle', url: mainBundleUrl(platform) },
    { platform, name: 'background.bundle', url: backgroundBundleUrl(platform) },
  ]);
  // Chained rather than Promise.all: two full bundle builds at once just
  // thrash CPU and make both slower.
  await targets.reduce(
    (chain, target) => chain.then(() => warmOne(target)),
    Promise.resolve(),
  );
}

void main();
