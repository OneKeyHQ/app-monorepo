#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { chromium } = require('playwright-core');

const repoRoot = path.resolve(__dirname, '../../..');
const extensionPath =
  process.env.EXT_E2E_EXTENSION_PATH ||
  path.join(repoRoot, 'apps', 'ext', 'build', 'chrome_v3');
const artifactDir =
  process.env.EXT_E2E_ARTIFACT_DIR || path.join(repoRoot, '.tmp', 'ext-e2e');

const BUILD_TIMEOUT_MS =
  Number(process.env.EXT_E2E_BUILD_TIMEOUT_MS) || 180_000;
const EXTENSION_TIMEOUT_MS =
  Number(process.env.EXT_E2E_EXTENSION_TIMEOUT_MS) || 120_000;

function log(message) {
  console.log(`[ext-e2e] ${message}`);
}

function yarnBin() {
  return process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
}

function getDevOnlyPassword() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}-onekey-debug`;
}

function getChromeExecutablePath() {
  if (process.env.EXT_E2E_BROWSER_EXECUTABLE) {
    return process.env.EXT_E2E_BROWSER_EXECUTABLE;
  }
  const playwrightChromePath = chromium.executablePath();
  if (playwrightChromePath && fs.existsSync(playwrightChromePath)) {
    return playwrightChromePath;
  }
  if (process.platform === 'darwin') {
    const chromePath =
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return undefined;
}

function readExtensionIdFromManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (typeof manifest.key !== 'string' || !manifest.key) {
    return undefined;
  }
  const publicKeyDer = Buffer.from(manifest.key, 'base64');
  const digest = crypto.createHash('sha256').update(publicKeyDer).digest();
  const alphabet = 'abcdefghijklmnop';
  return [...digest.subarray(0, 16)]
    .map((byte) => alphabet[byte >> 4] + alphabet[byte & 0x0f])
    .join('');
}

function runExtensionBuild() {
  if (process.env.EXT_E2E_SKIP_BUILD) {
    return;
  }

  log('build extension MV3 unpacked bundle');
  const result = spawnSync(
    yarnBin(),
    ['workspace', '@onekeyhq/ext', 'exec', 'rspack', 'build'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        E2E_MODE: 'true',
        EXT_MANIFEST_V3: '1',
        NODE_ENV: process.env.EXT_E2E_NODE_ENV || 'development',
        TRANSFORM_REGENERATOR_DISABLED: 'true',
      },
      stdio: 'inherit',
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`extension build exited with ${result.status}`);
  }
}

async function waitForExtensionServiceWorker(context) {
  const existing = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith('chrome-extension://'));
  if (existing) {
    return existing;
  }
  return context.waitForEvent('serviceworker', {
    predicate: (worker) => worker.url().startsWith('chrome-extension://'),
    timeout: EXTENSION_TIMEOUT_MS,
  });
}

async function waitForBackgroundApi(page) {
  const deadline = Date.now() + EXTENSION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const isReady = await page
      .evaluate(() =>
        Boolean(
          globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
            ?.runLocalSecretEnvelopeSelfTest &&
          globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
            ?.runLocalSecretEnvelopeRestoreSelfTest,
        ),
      )
      .catch(() => false);
    if (isReady) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for extension backgroundApi serviceE2E');
}

async function runLocalSecretEnvelopeFlow(page) {
  await waitForBackgroundApi(page);
  const result = await page.evaluate(
    async ({ devOnlyPassword }) => {
      const serviceE2E =
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E;
      if (!serviceE2E?.runLocalSecretEnvelopeSelfTest) {
        throw new Error(
          'serviceE2E.runLocalSecretEnvelopeSelfTest unavailable',
        );
      }
      if (!serviceE2E.runLocalSecretEnvelopeRestoreSelfTest) {
        throw new Error(
          'serviceE2E.runLocalSecretEnvelopeRestoreSelfTest unavailable',
        );
      }
      return serviceE2E.runLocalSecretEnvelopeSelfTest(
        {
          $$devOnlyPassword: devOnlyPassword,
        },
        {
          expectedCredentialLayerKinds: ['indexeddb-cryptokey'],
          expectedRuntimePlatform: 'extension',
          expectedStrength: 'profile-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(result.runtimePlatform, 'extension');
  assert.equal(result.verifyStringIsLse, true);
  assert.deepEqual(result.credentialLayerKinds, ['indexeddb-cryptokey']);
  assert.deepEqual(result.verifyStringLayerKinds, ['indexeddb-cryptokey']);
  assert.equal(result.credentialStrength, 'profile-bound');
  assert.equal(result.verifyStringStrength, 'profile-bound');
  assert.equal(result.cryptoKeyDeletionBlocksUnwrap, true);
  assert.equal(result.secureStorageDeletionBlocksUnwrap, false);
  assert.equal(result.layerDeletionBlocksUnwrap['indexeddb-cryptokey'], true);

  const restoreResult = await page.evaluate(
    async ({ devOnlyPassword }) => {
      const serviceE2E =
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E;
      return serviceE2E.runLocalSecretEnvelopeRestoreSelfTest(
        {
          $$devOnlyPassword: devOnlyPassword,
        },
        {
          expectedCredentialLayerKinds: ['indexeddb-cryptokey'],
          expectedRuntimePlatform: 'extension',
          expectedStrength: 'profile-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(restoreResult.passed, true);
  assert.equal(restoreResult.runtimePlatform, 'extension');
  const restoreSummary = restoreResult.summary || {};
  assert.equal(restoreSummary.rawCredentialIsLse, true);
  assert.deepEqual(restoreSummary.credentialLayerKinds, [
    'indexeddb-cryptokey',
  ]);
  assert.equal(restoreSummary.credentialStrength, 'profile-bound');
  assert.equal(restoreSummary.innerCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.backupPortableCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.primeTransferPortableCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.backupRejectsRawLocalSecretEnvelope, true);
  assert.equal(restoreSummary.primeTransferRejectsRawLocalSecretEnvelope, true);

  log(
    'local secret envelope extension self-test passed (indexeddb-cryptokey + restore)',
  );
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  runExtensionBuild();

  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found: ${manifestPath}`);
  }
  const extensionId =
    process.env.EXT_E2E_EXTENSION_ID ||
    readExtensionIdFromManifest(manifestPath);

  const executablePath = getChromeExecutablePath();
  if (!executablePath) {
    throw new Error(
      'No browser executable found. Set EXT_E2E_BROWSER_EXECUTABLE to run extension E2E.',
    );
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-ext-e2e-'));
  let context;
  let page;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        '--disable-features=DisableLoadExtensionCommandLineSwitch',
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
      // MV3 forbids `'unsafe-eval'` in the extension CSP, so Playwright's
      // page.evaluate (which calls the page's `eval` to reconstruct the
      // serialized function) is blocked by CSP. Bypass CSP enforcement at
      // runtime so the self-test can be driven from the popup page. Paired with
      // the E2E SES L0 override (getConfiguredSesHardenLevel) that keeps the
      // native `eval` from being replaced by SES `'no-eval'`.
      bypassCSP: true,
      executablePath,
      headless: process.env.EXT_E2E_HEADLESS !== 'false',
      ignoreDefaultArgs: [
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--no-service-autorun',
      ],
    });
    if (!extensionId) {
      throw new Error('Extension id cannot be derived from manifest key');
    }
    page = await context.newPage();
    try {
      await page.goto(`chrome-extension://${extensionId}/ui-popup.html`, {
        timeout: EXTENSION_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
    } catch (error) {
      if (String(error?.message || error).includes('ERR_BLOCKED_BY_CLIENT')) {
        throw new Error(
          [
            'Chrome blocked the extension page. The unpacked extension was likely not loaded.',
            'Use a Chrome/Chromium executable that allows --load-extension,',
            'or set EXT_E2E_BROWSER_EXECUTABLE and EXT_E2E_EXTENSION_ID explicitly.',
          ].join(' '),
          { cause: error },
        );
      }
      throw error;
    }
    // Ensure the background service worker has started (it hosts the real
    // BackgroundApi the popup proxies into); the self-test itself runs from the
    // popup page because Playwright's evaluate needs a CSP-bypassable context.
    await waitForExtensionServiceWorker(context);
    await runLocalSecretEnvelopeFlow(page);
  } catch (error) {
    if (page) {
      const screenshotPath = path.join(
        artifactDir,
        'local-secret-envelope-failure.png',
      );
      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => {});
      log(`failure screenshot: ${screenshotPath}`);
    }
    throw error;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    fs.rmSync(userDataDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
