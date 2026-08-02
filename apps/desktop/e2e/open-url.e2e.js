#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const { _electron: electron } = require('playwright-core');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopDir = path.join(repoRoot, 'apps', 'desktop');
const mainPath = path.join(desktopDir, 'app', 'dist', 'app.js');
const artifactDir =
  process.env.DESKTOP_E2E_ARTIFACT_DIR ||
  path.join(repoRoot, '.tmp', 'desktop-e2e');
const desktopE2EFlow = process.env.DESKTOP_E2E_FLOW || 'browser-open-url';
const targetInput = process.env.DESKTOP_E2E_OPEN_URL || 'apple.com';
const targetUrl = toUrl(targetInput);
const expectedHost = stripWww(new URL(targetUrl).hostname);
const expectedContentText =
  process.env.DESKTOP_E2E_EXPECT_TEXT ||
  (expectedHost === 'apple.com' ? 'Apple' : expectedHost);
const sniTarget = {
  hostname: process.env.DESKTOP_E2E_SNI_HOSTNAME || 'wallet.onekeytest.com',
  ip: process.env.DESKTOP_E2E_SNI_IP || '104.18.31.39',
  path: process.env.DESKTOP_E2E_SNI_PATH || '/wallet/v1/health',
  timeout: Number(process.env.DESKTOP_E2E_SNI_TIMEOUT_MS) || 15_000,
};
const SNI_QUEUE_REQUEST_COUNT = 20;
const SNI_QUEUE_ACTIVE_LIMIT = 16;
const SNI_QUEUE_PENDING_COUNT =
  SNI_QUEUE_REQUEST_COUNT - SNI_QUEUE_ACTIVE_LIMIT;

const COPY_INJECT_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_COPY_INJECT_TIMEOUT_MS) || 60_000;
const BUILD_MAIN_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_BUILD_MAIN_TIMEOUT_MS) || 120_000;
const RENDERER_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_RENDERER_TIMEOUT_MS) || 180_000;
const APP_TIMEOUT_MS = Number(process.env.DESKTOP_E2E_APP_TIMEOUT_MS) || 90_000;
const PAGE_TIMEOUT_MS =
  Number(process.env.DESKTOP_E2E_PAGE_TIMEOUT_MS) || 120_000;
const DESKTOP_SHORTCUT_IPC_CHANNEL = 'app/shortcut';
const DESKTOP_BROWSER_SHORTCUT_EVENT = 'TabBrowser';
const desktopE2EEnv = {
  DESKTOP_E2E_MODE: 'true',
  E2E_MODE: 'true',
};

function log(message) {
  console.log(`[desktop-e2e] ${message}`);
}

function getRepoYarnCliPath() {
  const yarnRc = fs.readFileSync(path.join(repoRoot, '.yarnrc.yml'), 'utf8');
  const yarnPathMatch = /^yarnPath:\s*["']?([^"'\r\n]+)["']?\s*$/mu.exec(
    yarnRc,
  );
  if (!yarnPathMatch) {
    throw new Error('Unable to resolve yarnPath from .yarnrc.yml');
  }
  return path.resolve(repoRoot, yarnPathMatch[1].trim());
}

function yarnInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: process.execPath,
      args: [getRepoYarnCliPath(), ...args],
    };
  }
  return { command: 'yarn', args };
}

function getHostnameFromUrlLikeInput(input) {
  const hostWithPath = input.trim().split(/[/?#]/u)[0] || '';
  const hostWithPortAndAuth = hostWithPath.split('@').pop() || '';

  if (hostWithPortAndAuth.startsWith('[')) {
    const closingBracketIndex = hostWithPortAndAuth.indexOf(']');
    return closingBracketIndex > 0
      ? hostWithPortAndAuth.slice(1, closingBracketIndex).toLowerCase()
      : '';
  }

  if (net.isIP(hostWithPortAndAuth)) {
    return hostWithPortAndAuth.toLowerCase();
  }

  const portSeparatorIndex = hostWithPortAndAuth.lastIndexOf(':');
  if (
    portSeparatorIndex >= 0 &&
    hostWithPortAndAuth.indexOf(':') === portSeparatorIndex
  ) {
    return hostWithPortAndAuth.slice(0, portSeparatorIndex).toLowerCase();
  }

  return hostWithPortAndAuth.toLowerCase();
}

function shouldUseHttpPrefix(input) {
  const hostname = getHostnameFromUrlLikeInput(input);
  return hostname === 'localhost' || net.isIP(hostname) > 0;
}

function toUrl(input) {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) {
    return text;
  }
  return `${shouldUseHttpPrefix(text) ? 'http' : 'https'}://${text}`;
}

function stripWww(hostname) {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function getDevOnlyPassword() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}-onekey-debug`;
}

function assertIncludesAll(actual, expected, label) {
  const actualSet = new Set(actual);
  for (const value of expected) {
    assert(
      actualSet.has(value),
      `${label} should include ${value}, got ${JSON.stringify(actual)}`,
    );
  }
}

function appendOutput(buffer, chunk) {
  const value = `${buffer}${chunk.toString()}`;
  return value.length > 8000 ? value.slice(value.length - 8000) : value;
}

function runYarn(args, { timeoutMs }) {
  log(`run: yarn ${args.join(' ')}`);
  const invocation = yarnInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    timeout: timeoutMs,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`yarn ${args.join(' ')} exited with ${result.status}`);
  }
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
  throw new Error(`No available desktop E2E renderer port near ${startPort}`);
}

async function waitForRenderer(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null) {
      throw new Error(
        `Renderer dev server exited early with code ${child.exitCode}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    if (await httpOk(url)) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for renderer dev server at ${url}`);
}

async function startRenderer() {
  const preferredPort = Number(process.env.DESKTOP_E2E_PORT) || 3101;
  const port = await findAvailablePort(preferredPort);
  const rendererUrl = `http://localhost:${port}/`;

  log(`start renderer on ${rendererUrl}`);
  const rspackPackagePath = require.resolve('@rspack/cli/package.json', {
    paths: [repoRoot],
  });
  const rspackCliPath = path.join(
    path.dirname(rspackPackagePath),
    'bin',
    'rspack.js',
  );
  const child = spawn(process.execPath, [rspackCliPath, 'serve'], {
    cwd: desktopDir,
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ...desktopE2EEnv,
      BROWSER: 'none',
      TRANSFORM_REGENERATOR_DISABLED: 'true',
      WEB_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.DESKTOP_E2E_VERBOSE) {
      process.stdout.write(chunk);
    }
  });
  child.stderr.on('data', (chunk) => {
    output = appendOutput(output, chunk);
    if (process.env.DESKTOP_E2E_VERBOSE) {
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

async function waitForLocator(page, selectors, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      // eslint-disable-next-line no-await-in-loop
      const visible = await locator
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (visible) {
        return locator;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function findVisibleLocator(page, selectors, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      // eslint-disable-next-line no-await-in-loop
      const visible = await locator
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (visible) {
        return locator;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(250);
  }
  return null;
}

async function readWebviewStates(page) {
  const handles = await page.locator('webview').elementHandles();
  return Promise.all(
    handles.map((handle) =>
      handle
        .evaluate(async (element) => {
          let pageInfo = null;
          let pageInfoError = '';
          if (typeof element.executeJavaScript === 'function') {
            try {
              pageInfo = await element.executeJavaScript(`
                (() => {
                  const visibleText = (
                    document.body?.innerText ||
                    document.documentElement?.innerText ||
                    ''
                  ).replace(/\\s+/g, ' ').trim();
                  return {
                    bodyTextLength: visibleText.length,
                    bodyTextSample: visibleText.slice(0, 1200),
                    locationHref: window.location.href,
                    readyState: document.readyState,
                    title: document.title || ''
                  };
                })()
              `);
            } catch (error) {
              pageInfoError =
                error instanceof Error ? error.message : String(error);
            }
          }
          return {
            loading:
              typeof element.isLoading === 'function'
                ? element.isLoading()
                : undefined,
            pageInfo,
            pageInfoError,
            src: element.getAttribute('src') || '',
            title:
              typeof element.getTitle === 'function' ? element.getTitle() : '',
            url: typeof element.getURL === 'function' ? element.getURL() : '',
          };
        })
        .catch(() => ({ src: '', title: '', url: '' })),
    ),
  );
}

function matchesExpectedHost(value) {
  if (!value) {
    return false;
  }
  try {
    const host = stripWww(new URL(value).hostname);
    return host === expectedHost || host.endsWith(`.${expectedHost}`);
  } catch (_) {
    return false;
  }
}

function includesExpectedContentText(value) {
  return value.toLowerCase().includes(expectedContentText.toLowerCase());
}

function hasLoadedExpectedPageContent(state) {
  const pageInfo = state.pageInfo;
  if (!pageInfo) {
    return false;
  }
  const ready =
    pageInfo.readyState === 'complete' || pageInfo.readyState === 'interactive';
  const hasBody = Number(pageInfo.bodyTextLength) > 0;
  const hasExpectedText =
    includesExpectedContentText(pageInfo.title || '') ||
    includesExpectedContentText(pageInfo.bodyTextSample || '');
  return ready && hasBody && hasExpectedText;
}

async function emitDesktopShortcut(app, eventName) {
  await app.evaluate(
    ({ BrowserWindow }, { channel, shortcutEvent }) => {
      const window = BrowserWindow.getAllWindows().find(
        (browserWindow) => !browserWindow.isDestroyed(),
      );
      if (!window) {
        throw new Error('No desktop window available for E2E shortcut');
      }
      window.webContents.send(channel, shortcutEvent);
    },
    {
      channel: DESKTOP_SHORTCUT_IPC_CHANNEL,
      shortcutEvent: eventName,
    },
  );
}

async function openBrowserTab(app, page) {
  await waitForLocator(
    page,
    ['[data-testid="Desktop-AppSideBar-Container"]'],
    APP_TIMEOUT_MS,
    'Desktop app sidebar',
  );
  await emitDesktopShortcut(app, DESKTOP_BROWSER_SHORTCUT_EVENT);
}

async function waitForLoadedWebviewPage(page) {
  const deadline = Date.now() + PAGE_TIMEOUT_MS;
  let lastStates = [];
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    lastStates = await readWebviewStates(page);
    const match = lastStates.find(
      (state) =>
        matchesExpectedHost(state.url) || matchesExpectedHost(state.src),
    );
    if (match && hasLoadedExpectedPageContent(match)) {
      return match;
    }
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
  }
  throw new Error(
    `Timed out waiting for webview to load ${expectedHost}. Last states: ${JSON.stringify(
      lastStates,
    )}`,
  );
}

async function runBrowserOpenUrlFlow(app, page) {
  await page.waitForLoadState('domcontentloaded', { timeout: APP_TIMEOUT_MS });

  await openBrowserTab(app, page);

  const searchInput = await waitForLocator(
    page,
    [
      'input[data-testid="search-input"]',
      '[data-testid="search-input"] input',
      'textarea[data-testid="search-input"]',
      'input[placeholder*="Search dApps"]',
      'input[placeholder*="enter URL"]',
    ],
    APP_TIMEOUT_MS,
    'Browser home search input',
  );

  await searchInput.fill(targetUrl);
  const directUrlResult = await findVisibleLocator(
    page,
    ['[data-testid="dapp-search0"]'],
    5000,
  );
  if (directUrlResult) {
    await directUrlResult.click({ force: true });
  } else {
    await searchInput.press('Enter');
  }

  const state = await waitForLoadedWebviewPage(page);
  assert(
    matchesExpectedHost(state.url) || matchesExpectedHost(state.src),
    `Expected loaded webview host ${expectedHost}, got ${JSON.stringify(
      state,
    )}`,
  );

  log(
    `loaded ${
      state.pageInfo?.locationHref || state.url || state.src
    } (${state.pageInfo?.title || state.title || 'untitled'}, ${
      state.pageInfo?.bodyTextLength || 0
    } chars)`,
  );
}

async function runLocalSecretEnvelopeFlow(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: APP_TIMEOUT_MS });
  await waitForLocator(
    page,
    ['[data-testid="Desktop-AppSideBar-Container"]'],
    APP_TIMEOUT_MS,
    'Desktop app sidebar',
  );
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.runLocalSecretEnvelopeSelfTest &&
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.runLocalSecretEnvelopeRestoreSelfTest,
      ),
    undefined,
    { timeout: APP_TIMEOUT_MS },
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
          expectedCredentialLayerKinds: [
            'indexeddb-cryptokey',
            'secure-storage',
          ],
          expectedRuntimePlatform: 'desktop',
          expectedStrength: 'secure-storage-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(result.runtimePlatform, 'desktop');
  assert.equal(result.verifyStringIsLse, false);
  assert.equal(result.credentialStrength, 'secure-storage-bound');
  assert.equal(result.verifyStringStrength, 'unavailable');
  assert.equal(result.cryptoKeyDeletionBlocksUnwrap, true);
  assert.equal(result.secureStorageDeletionBlocksUnwrap, true);
  assertIncludesAll(
    result.credentialLayerKinds,
    ['indexeddb-cryptokey', 'secure-storage'],
    'credential layers',
  );
  assert.deepEqual(result.verifyStringLayerKinds, []);

  const restoreResult = await page.evaluate(
    async ({ devOnlyPassword }) => {
      const serviceE2E =
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E;
      return serviceE2E.runLocalSecretEnvelopeRestoreSelfTest(
        {
          $$devOnlyPassword: devOnlyPassword,
        },
        {
          expectedCredentialLayerKinds: [
            'indexeddb-cryptokey',
            'secure-storage',
          ],
          expectedRuntimePlatform: 'desktop',
          expectedStrength: 'secure-storage-bound',
        },
      );
    },
    {
      devOnlyPassword: getDevOnlyPassword(),
    },
  );

  assert.equal(restoreResult.passed, true);
  assert.equal(restoreResult.runtimePlatform, 'desktop');
  const restoreSummary = restoreResult.summary || {};
  assert.equal(restoreSummary.rawCredentialIsLse, true);
  assert.equal(restoreSummary.credentialStrength, 'secure-storage-bound');
  assertIncludesAll(
    restoreSummary.credentialLayerKinds,
    ['indexeddb-cryptokey', 'secure-storage'],
    'restore credential layers',
  );
  assert.equal(restoreSummary.innerCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.backupPortableCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.primeTransferPortableCredentialPrefix, '|PK|');
  assert.equal(restoreSummary.backupRejectsRawLocalSecretEnvelope, true);
  assert.equal(restoreSummary.primeTransferRejectsRawLocalSecretEnvelope, true);

  log(
    `local secret envelope self-test passed (${result.credentialLayerKinds.join(
      ' + ',
    )} + restore)`,
  );
}

function assertSniResponseStatus(statusCode, label) {
  assert(
    Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599,
    `${label} should return a valid HTTPS status, got ${statusCode}`,
  );
}

function assertSniCancelled(outcome, label) {
  assert.equal(outcome.state, 'rejected', `${label} should reject`);
  assert(
    outcome.code === 'SNI_CANCELLED' ||
      /\bSNI_CANCELLED\b/u.test(outcome.message),
    `${label} should reject with SNI_CANCELLED, got ${JSON.stringify(outcome)}`,
  );
}

async function runSniRequestFlow(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: APP_TIMEOUT_MS });
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.desktopApiProxy?.sniRequest?.request &&
        globalThis.desktopApiProxy.sniRequest.cancelRequest &&
        globalThis.desktopApiProxy.sniRequest.cancelAllRequests &&
        globalThis.desktopApiProxy.sniRequest.getDebugSnapshot,
      ),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );

  const result = await page.evaluate(
    async ({ activeLimit, pendingCount, requestCount, target }) => {
      const proxy = globalThis.desktopApiProxy?.sniRequest;
      if (!proxy) {
        throw new Error('desktopApiProxy.sniRequest unavailable');
      }

      const runId = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const buildConfig = (requestId, phase) => ({
        requestId,
        ip: target.ip,
        hostname: target.hostname,
        path: `${target.path}${target.path.includes('?') ? '&' : '?'}desktopE2E=${phase}-${runId}`,
        headers: {
          Accept: 'application/json',
          'X-OneKey-Desktop-E2E': phase,
        },
        method: 'GET',
        body: null,
        timeout: target.timeout,
      });
      const toOutcome = (promise) =>
        promise.then(
          (response) => ({
            state: 'resolved',
            statusCode: response.statusCode,
          }),
          (error) => ({
            state: 'rejected',
            code:
              error && typeof error === 'object' && 'code' in error
                ? String(error.code)
                : '',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      const waitForSnapshot = async (predicate, label) => {
        const deadline = Date.now() + 10_000;
        let nextSnapshot;
        do {
          nextSnapshot = await proxy.getDebugSnapshot({
            hostname: target.hostname,
            ip: target.ip,
          });
          if (predicate(nextSnapshot)) return nextSnapshot;
          await new Promise((resolve) => setTimeout(resolve, 10));
        } while (Date.now() < deadline);
        throw new Error(
          `${label} snapshot was not observed: ${JSON.stringify(nextSnapshot)}`,
        );
      };

      const supported = await proxy.isSupported();
      const initialResponse = await proxy.request(
        buildConfig(`desktop-e2e-success-${runId}`, 'success'),
      );

      await proxy.clearDNSCache();
      const targetedRequestId = `desktop-e2e-cancel-${runId}`;
      const targetedOutcomePromise = toOutcome(
        proxy.request(buildConfig(targetedRequestId, 'cancel')),
      );
      const targetedCancelResult = await proxy.cancelRequest(targetedRequestId);
      const targetedOutcome = await targetedOutcomePromise;

      await proxy.clearDNSCache();
      const queueRequests = Array.from({ length: requestCount }, (_, index) => {
        const requestId = `desktop-e2e-queue-${runId}-${index}`;
        return {
          requestId,
          outcome: toOutcome(
            proxy.request(buildConfig(requestId, `queue-${index}`)),
          ),
        };
      });
      const queueSnapshot = await waitForSnapshot(
        (nextSnapshot) =>
          nextSnapshot.activeRequestsForPair === activeLimit &&
          nextSnapshot.pendingRequestsForPair === pendingCount,
        'saturated queue',
      );
      const queuedCancelResults = await Promise.all(
        queueRequests
          .slice(activeLimit)
          .map(({ requestId }) => proxy.cancelRequest(requestId)),
      );
      const pendingDrainedSnapshot = await waitForSnapshot(
        (nextSnapshot) => nextSnapshot.pendingRequestsForPair === 0,
        'queued cancellation',
      );
      const cancelAllResult = await proxy.cancelAllRequests();
      const queueRequestOutcomes = await Promise.all(
        queueRequests.map(({ outcome }) => outcome),
      );
      const finalSnapshot = await waitForSnapshot(
        (nextSnapshot) =>
          nextSnapshot.activeRequestsForPair === 0 &&
          nextSnapshot.pendingRequestsForPair === 0,
        'cancel-all cleanup',
      );

      const recoveryResponse = await proxy.request(
        buildConfig(`desktop-e2e-recovery-${runId}`, 'recovery'),
      );

      return {
        supported,
        initialStatusCode: initialResponse.statusCode,
        targetedCancelSuccess: targetedCancelResult.success,
        targetedOutcome,
        queueSnapshot,
        queuedCancelResults,
        pendingDrainedSnapshot,
        cancelAllSuccess: cancelAllResult.success,
        queueRequestOutcomes,
        finalSnapshot,
        recoveryStatusCode: recoveryResponse.statusCode,
      };
    },
    {
      activeLimit: SNI_QUEUE_ACTIVE_LIMIT,
      pendingCount: SNI_QUEUE_PENDING_COUNT,
      requestCount: SNI_QUEUE_REQUEST_COUNT,
      target: sniTarget,
    },
  );

  assert.equal(result.supported, true);
  assertSniResponseStatus(result.initialStatusCode, 'initial SNI request');
  assert.equal(result.targetedCancelSuccess, true);
  assertSniCancelled(result.targetedOutcome, 'targeted SNI cancellation');
  assert.equal(
    result.queueSnapshot.activeRequestsForPair,
    SNI_QUEUE_ACTIVE_LIMIT,
  );
  assert.equal(
    result.queueSnapshot.pendingRequestsForPair,
    SNI_QUEUE_PENDING_COUNT,
  );
  assert.equal(result.queuedCancelResults.length, SNI_QUEUE_PENDING_COUNT);
  result.queuedCancelResults.forEach((cancelResult, index) => {
    assert.equal(cancelResult.success, true, `queued cancellation ${index}`);
  });
  assert.equal(result.pendingDrainedSnapshot.pendingRequestsForPair, 0);
  assert.equal(result.cancelAllSuccess, true);
  assert.equal(result.queueRequestOutcomes.length, SNI_QUEUE_REQUEST_COUNT);
  result.queueRequestOutcomes.forEach((outcome, index) => {
    assertSniCancelled(outcome, `queue SNI request ${index}`);
  });
  assert.equal(result.finalSnapshot.activeRequestsForPair, 0);
  assert.equal(result.finalSnapshot.pendingRequestsForPair, 0);
  assertSniResponseStatus(result.recoveryStatusCode, 'recovery SNI request');

  await page.waitForFunction(
    () => globalThis.$$appGlobals?.$navigationRef?.current?.isReady(),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );
  await page.evaluate(() => {
    globalThis.$$appGlobals.$navigationRef.current.navigate('main', {
      screen: 'Developer',
      params: {
        screen: 'component-IpRequest',
      },
    });
  });
  const queuePanel = page.locator('[data-testid="desktop-sni-queue-panel"]');
  const queueRunButton = page.locator('[data-testid="desktop-sni-queue-run"]');
  await queueRunButton.waitFor({ state: 'visible', timeout: APP_TIMEOUT_MS });
  await queueRunButton.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="desktop-sni-queue-result"]')
        ?.textContent?.includes('PASS'),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );
  assert(
    (await queuePanel.textContent()).includes('16 active + 4 pending observed'),
    'desktop SNI queue panel should display the saturated queue observation',
  );
  await queuePanel.screenshot({
    path: path.join(artifactDir, 'sni-queue-panel.png'),
  });

  log(
    `SNI Node integration and QA panel passed (${sniTarget.hostname} via ${sniTarget.ip}, statuses ${result.initialStatusCode}/${result.recoveryStatusCode}, targeted cancel + ${SNI_QUEUE_ACTIVE_LIMIT} active/${SNI_QUEUE_PENDING_COUNT} pending queue cancellation)`,
  );
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });

  if (!process.env.DESKTOP_E2E_SKIP_COPY_INJECT) {
    runYarn(['copy:inject'], {
      timeoutMs: COPY_INJECT_TIMEOUT_MS,
    });
  }

  if (!process.env.DESKTOP_E2E_SKIP_BUILD_MAIN) {
    runYarn(['workspace', '@onekeyhq/desktop', 'build:main:dev'], {
      timeoutMs: BUILD_MAIN_TIMEOUT_MS,
    });
  }

  if (!fs.existsSync(mainPath)) {
    throw new Error(`Desktop main file not found: ${mainPath}`);
  }

  const { child: rendererProcess, rendererUrl } = await startRenderer();
  const userDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-desktop-e2e-'),
  );

  let app;
  let page;
  try {
    log('launch Electron');
    app = await electron.launch({
      executablePath: require('electron'),
      args: [mainPath],
      cwd: desktopDir,
      env: {
        ...process.env,
        ...desktopE2EEnv,
        DESKTOP_E2E_RENDERER_URL: rendererUrl,
        DESKTOP_E2E_USER_DATA_DIR: userDataDir,
      },
      timeout: APP_TIMEOUT_MS,
    });

    page = await app.firstWindow({ timeout: APP_TIMEOUT_MS });
    await page.waitForURL((url) => url.toString().startsWith(rendererUrl), {
      timeout: APP_TIMEOUT_MS,
    });

    if (desktopE2EFlow === 'browser-open-url') {
      await runBrowserOpenUrlFlow(app, page);
    } else if (desktopE2EFlow === 'local-secret-envelope') {
      await runLocalSecretEnvelopeFlow(page);
    } else if (desktopE2EFlow === 'sni-request') {
      await runSniRequestFlow(page);
    } else {
      throw new Error(`Unknown desktop E2E flow: ${desktopE2EFlow}`);
    }
  } catch (error) {
    if (page) {
      const screenshotPath = path.join(
        artifactDir,
        `${desktopE2EFlow}-failure.png`,
      );
      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => {});
      log(`failure screenshot: ${screenshotPath}`);
    }
    throw error;
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
    await stopProcess(rendererProcess);
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
