#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const { chromium } = require('playwright-core');

const repoRoot = path.resolve(__dirname, '../../..');
const artifactDir =
  process.env.WEB_E2E_ARTIFACT_DIR || path.join(repoRoot, '.tmp', 'web-e2e');

const RENDERER_TIMEOUT_MS =
  Number(process.env.WEB_E2E_RENDERER_TIMEOUT_MS) || 180_000;
const PAGE_TIMEOUT_MS = Number(process.env.WEB_E2E_PAGE_TIMEOUT_MS) || 120_000;
const webE2EEnv = {
  E2E_MODE: 'true',
};

function log(message) {
  console.log(`[web-e2e] ${message}`);
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

function appendOutput(buffer, chunk) {
  const value = `${buffer}${chunk.toString()}`;
  return value.length > 8000 ? value.slice(value.length - 8000) : value;
}

function httpOk(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(
        Boolean(response.statusCode) &&
          response.statusCode >= 200 &&
          response.statusCode < 500,
      );
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available web E2E port near ${startPort}`);
}

async function waitForRenderer(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      throw new Error(
        `Web dev server exited early with code ${child.exitCode}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    if (await httpOk(url)) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for web dev server at ${url}`);
}

async function startWebRenderer() {
  const preferredPort = Number(process.env.WEB_E2E_PORT) || 3201;
  const port = await findAvailablePort(preferredPort);
  const rendererUrl = `http://localhost:${port}/`;

  log(`start renderer on ${rendererUrl}`);
  const child = spawn(
    yarnBin(),
    ['workspace', '@onekeyhq/web', 'exec', 'rspack', 'serve'],
    {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        ...webE2EEnv,
        BROWSER: 'none',
        TRANSFORM_REGENERATOR_DISABLED: 'true',
        WEB_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';
  child.stdout.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.WEB_E2E_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  child.stderr.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.WEB_E2E_VERBOSE) {
      process.stderr.write(chunk);
    }
  });

  try {
    await waitForRenderer(rendererUrl, child, RENDERER_TIMEOUT_MS);
  } catch (error) {
    await stopProcess(child);
    throw new Error(`${error.message}\n\nRenderer output tail:\n${output}`, {
      cause: error,
    });
  }

  return { child, rendererUrl };
}

async function stopProcess(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      child.kill();
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch (_) {
    try {
      child.kill('SIGTERM');
    } catch (_e) {
      // ignore cleanup errors
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (child.exitCode === null) {
    try {
      if (process.platform === 'win32') {
        child.kill('SIGKILL');
      } else {
        process.kill(-child.pid, 'SIGKILL');
      }
    } catch (_) {
      // ignore cleanup errors
    }
  }
}

function getChromeExecutablePath() {
  if (process.env.WEB_E2E_BROWSER_EXECUTABLE) {
    return process.env.WEB_E2E_BROWSER_EXECUTABLE;
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

async function launchBrowser() {
  const executablePath = getChromeExecutablePath();
  if (!executablePath) {
    throw new Error(
      'No browser executable found. Set WEB_E2E_BROWSER_EXECUTABLE to run web E2E.',
    );
  }
  return chromium.launch({
    args: ['--no-sandbox'],
    executablePath,
    headless: true,
  });
}

async function runLocalSecretEnvelopeFlow(page, rendererUrl) {
  await page.goto(rendererUrl, {
    timeout: PAGE_TIMEOUT_MS,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.runLocalSecretEnvelopeSelfTest &&
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.runLocalSecretEnvelopeRestoreSelfTest,
      ),
    undefined,
    { timeout: PAGE_TIMEOUT_MS },
  );

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
          expectedRuntimePlatform: 'web',
          expectedStrength: 'profile-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(result.runtimePlatform, 'web');
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
          expectedRuntimePlatform: 'web',
          expectedStrength: 'profile-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(restoreResult.passed, true);
  assert.equal(restoreResult.runtimePlatform, 'web');
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
    'local secret envelope web self-test passed (indexeddb-cryptokey + restore)',
  );
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });

  const { child: rendererProcess, rendererUrl } = await startWebRenderer();
  let browser;
  let page;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext();
    page = await context.newPage();
    await runLocalSecretEnvelopeFlow(page, rendererUrl);
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
    if (browser) {
      await browser.close().catch(() => {});
    }
    await stopProcess(rendererProcess);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
