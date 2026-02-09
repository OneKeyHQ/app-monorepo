#!/usr/bin/env node

/**
 * Web perf "prepare state" helper (manual):
 * - Build @onekeyhq/web with PERF_MONITOR_ENABLED=1 (optional skip)
 * - Serve static build
 * - Launch a persistent Chromium/Edge profile with extensions enabled
 * - Keep the browser open until user terminates this process
 *
 * This is used to prepare a stable login/wallet state on perf machines.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { chromium } = require('playwright-core');

const { execCmd } = require('./lib/exec');
const { ensureDir, fileExists } = require('./lib/fs');
const { readPerfCiLocalConfig } = require('./lib/config');
const { findChromiumExecutable } = require('./lib/chromium');
const { startStaticServer } = require('./lib/staticServer');

function ensureDirExists(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function buildWeb({ repoRoot, outputDir }) {
  const skip = process.env.PERF_SKIP_BUILD === '1';
  if (skip) return;

  const res = await execCmd('yarn', ['workspace', '@onekeyhq/web', 'build'], {
    cwd: repoRoot,
    env: {
      PERF_MONITOR_ENABLED: '1',
    },
    timeoutMs: Number(process.env.PERF_WEB_BUILD_TIMEOUT_MS) || 30 * 60 * 1000,
    stdout: (d) => process.stdout.write(d),
    stderr: (d) => process.stderr.write(d),
  });
  if (res.code !== 0) {
    throw new Error(
      `web build failed with exit code ${res.code} (output=${outputDir})`,
    );
  }
}

async function main() {
  const repoRoot = path.join(__dirname, '..', '..');
  const localConfig = readPerfCiLocalConfig(repoRoot) || {};

  const buildDir =
    process.env.PERF_WEB_BUILD_DIR ||
    path.join(repoRoot, 'apps', 'web', 'web-build');

  const profileDir =
    process.env.PERF_WEB_PROFILE_DIR ||
    localConfig.webProfileDir ||
    path.join(os.homedir(), 'perf-profiles', 'web');
  ensureDirExists(profileDir);

  const preferredBrowser = localConfig.chromeExecutablePath || null;
  const executablePath = findChromiumExecutable(preferredBrowser);
  if (!executablePath) {
    throw new Error(
      [
        'Chromium/Chrome/Edge executable not found.',
        '',
        'Fix options:',
        '- Install Google Chrome / Microsoft Edge on the perf machine',
        '- Or set PERF_CHROME_EXECUTABLE_PATH=/absolute/path/to/Chromium',
        '- Or set chromeExecutablePath in development/perf-ci/config.local.json',
      ].join('\n'),
    );
  }

  const outputDir =
    process.env.PERF_WEB_PREPARE_OUTPUT_DIR ||
    path.join(repoRoot, 'development', 'perf-ci', 'output', 'web-prepare');
  ensureDir(outputDir);

  await buildWeb({ repoRoot, outputDir });

  if (!fileExists(path.join(buildDir, 'index.html'))) {
    throw new Error(`web build output missing index.html: ${buildDir}`);
  }

  const staticServer = await startStaticServer({
    rootDir: buildDir,
    host: '127.0.0.1',
    // IMPORTANT: when using browser-extension wallets, permissions are bound to the site origin.
    // Use a stable port by default so the "connected site" state persists across runs.
    port:
      Number(process.env.PERF_WEB_PORT) || Number(localConfig.webPort) || 3123,
    spaFallback: true,
  });

  const webUrl = process.env.PERF_WEB_URL || staticServer.baseUrl;

  // eslint-disable-next-line no-console
  console.log('[perf] web prepare mode: opening browser for manual setup');
  // eslint-disable-next-line no-console
  console.log(`[perf] url=${webUrl}`);
  // eslint-disable-next-line no-console
  console.log(`[perf] profileDir=${profileDir}`);
  // eslint-disable-next-line no-console
  console.log('[perf] Press Ctrl+C to close browser and stop the server.');

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    executablePath,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      ...(process.env.PERF_WEB_EXTENSION_DIR
        ? [
            `--disable-extensions-except=${process.env.PERF_WEB_EXTENSION_DIR}`,
            `--load-extension=${process.env.PERF_WEB_EXTENSION_DIR}`,
          ]
        : []),
    ],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(webUrl, { waitUntil: 'domcontentloaded' });

  const shutdown = async () => {
    try {
      await context.close();
    } catch {
      // ignore
    }
    try {
      await staticServer.close();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive.
  // eslint-disable-next-line no-await-in-loop
  while (true) await new Promise((r) => setTimeout(r, 60_000));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.stack || e?.message || String(e));
  process.exit(2);
});
