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
  path: process.env.DESKTOP_E2E_SNI_PATH || '/health',
  timeout: Number(process.env.DESKTOP_E2E_SNI_TIMEOUT_MS) || 15_000,
};
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
      const targetWindow = BrowserWindow.getAllWindows().find(
        (browserWindow) => !browserWindow.isDestroyed(),
      );
      if (!targetWindow) {
        throw new Error('No desktop window available for E2E shortcut');
      }
      targetWindow.webContents.send(channel, shortcutEvent);
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
          ?.runLocalSecretEnvelopeRestoreSelfTest &&
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E
          ?.runHyperLiquidAgentMigrationSelfTest,
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
      if (!serviceE2E.runHyperLiquidAgentMigrationSelfTest) {
        throw new Error(
          'serviceE2E.runHyperLiquidAgentMigrationSelfTest unavailable',
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

  const agentMigrationResult = await page.evaluate(
    async ({ devOnlyPassword }) => {
      const serviceE2E =
        globalThis.$$appGlobals?.$backgroundApiProxy?.serviceE2E;
      return serviceE2E.runHyperLiquidAgentMigrationSelfTest(
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

  assert.equal(
    agentMigrationResult.passed,
    true,
    `HL Agent migration failures: ${JSON.stringify(
      agentMigrationResult.checkpoints?.filter(
        (checkpoint) => checkpoint.status === 'failed',
      ),
    )}`,
  );
  assert.equal(agentMigrationResult.runtimePlatform, 'desktop');
  const agentSummary = agentMigrationResult.summary || {};
  assert.equal(agentSummary.legacySourceStored, true);
  assert.equal(agentSummary.rawCredentialIsLse, true);
  assert.equal(agentSummary.expectedInnerPrefix, '|HLE|');
  assert.equal(agentSummary.migratedInnerPrefix, '|HLE|');
  assertIncludesAll(
    agentSummary.credentialLayerKinds,
    ['indexeddb-cryptokey', 'secure-storage'],
    'HL Agent credential layers',
  );
  assert.equal(agentSummary.credentialStrength, 'secure-storage-bound');
  assert.equal(agentSummary.privateKeyAbsentFromEnvelope, true);
  assert.equal(agentSummary.readBackMatches, true);
  assert.equal(agentSummary.signatureVerified, true);
  assert.equal(agentSummary.sessionRestored, true);
  assert.equal(agentSummary.restoredSessionDecrypts, true);
  assert.equal(agentSummary.lockedSigningBlocked, true);
  assert.equal(agentSummary.wrongPasswordSigningBlocked, true);
  assert.equal(agentSummary.signingAfterUnlockAgainVerified, true);

  log(
    `local secret envelope self-test passed (${result.credentialLayerKinds.join(
      ' + ',
    )} + restore + HL Agent migration)`,
  );
}

function assertSniResponseStatus(statusCode, label) {
  assert(
    Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599,
    `${label} should return a valid HTTPS status, got ${statusCode}`,
  );
}

async function runSniRequestFlow(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: APP_TIMEOUT_MS });
  await page.waitForFunction(
    () =>
      Boolean(
        globalThis.desktopApiProxy?.sniRequest?.isSupported &&
        globalThis.desktopApiProxy.sniRequest.request,
      ),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );

  const result = await page.evaluate(async (target) => {
    const proxy = globalThis.desktopApiProxy?.sniRequest;
    if (!proxy) {
      throw new Error('desktopApiProxy.sniRequest unavailable');
    }

    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const config = {
      requestId: `desktop-e2e-smoke-${runId}`,
      ip: target.ip,
      hostname: target.hostname,
      path: target.path,
      headers: {
        Accept: 'application/json',
        'X-OneKey-Desktop-E2E': 'smoke',
      },
      method: 'GET',
      body: null,
      timeout: target.timeout,
    };

    const supported = await proxy.isSupported();
    const response = await proxy.request(config);

    return {
      supported,
      statusCode: response.statusCode,
    };
  }, sniTarget);

  assert.equal(result.supported, true);
  assertSniResponseStatus(result.statusCode, 'SNI bridge smoke request');

  await page.waitForFunction(
    () => globalThis.$$appGlobals?.$navigationRef?.current?.isReady(),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    await globalThis.$$appGlobals.$backgroundApiProxy.serviceDevSetting.switchDevMode(
      true,
    );
    await globalThis.$$appGlobals.$backgroundApiProxy.serviceDevSetting.updateDevSetting(
      'networkThrottleEnabled',
      false,
    );
    globalThis.$$appGlobals.$navigationRef.current.navigate('modal', {
      screen: 'SettingModal',
      params: {
        screen: 'SettingListModal',
      },
    });
  });
  const settingsModal = page.locator('[data-testid="APP-Modal-Screen"]').last();
  const developerModeTab = settingsModal.locator(
    '[data-testid="tab-modal-no-active-item-CodeSolid"], [data-testid="tab-modal-active-item-CodeSolid"]',
  );
  await developerModeTab.waitFor({
    state: 'visible',
    timeout: APP_TIMEOUT_MS,
  });
  await developerModeTab.click();
  await settingsModal
    .getByText('Dev Tools & Dev Settings', { exact: true })
    .click();
  const queueQaMenu = settingsModal.locator(
    '[data-testid="desktop-sni-queue-qa-menu"]',
  );
  await queueQaMenu.waitFor({ state: 'visible', timeout: APP_TIMEOUT_MS });
  await queueQaMenu.click();
  const queuePanel = page.locator('[data-testid="desktop-sni-queue-panel"]');
  const queueRunButton = page.locator('[data-testid="desktop-sni-queue-run"]');
  await queueRunButton.waitFor({ state: 'visible', timeout: APP_TIMEOUT_MS });

  const healthRunButton = page.locator(
    '[data-testid="desktop-sni-case-health-run"]',
  );
  await healthRunButton.click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="desktop-sni-case-health-result"]')
        ?.textContent?.includes('PASSED'),
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );

  await queueRunButton.click();
  await page.waitForFunction(
    () => {
      const text = document.querySelector(
        '[data-testid="desktop-sni-queue-result"]',
      )?.textContent;
      return text?.includes('PASS') || text?.includes('PARTIAL');
    },
    undefined,
    { timeout: APP_TIMEOUT_MS },
  );
  const passedCaseIds = [
    'health',
    'burst-20',
    'burst-40',
    'abort-all-recovery',
    'repeat-40',
  ];
  const caseResultTexts = await Promise.all(
    passedCaseIds.map((caseId) =>
      page
        .locator(`[data-testid="desktop-sni-case-${caseId}-result"]`)
        .textContent(),
    ),
  );
  caseResultTexts.forEach((caseResultText, index) => {
    assert(
      caseResultText.includes('PASSED'),
      `desktop SNI QA case ${passedCaseIds[index]} should pass`,
    );
  });
  const notObservedCaseIds = ['active-abort', 'pending-abort'];
  const notObservedResultTexts = await Promise.all(
    notObservedCaseIds.map((caseId) =>
      page
        .locator(`[data-testid="desktop-sni-case-${caseId}-result"]`)
        .textContent(),
    ),
  );
  notObservedResultTexts.forEach((caseResultText, index) => {
    assert(
      caseResultText.includes('NOT OBSERVED'),
      `desktop SNI QA case ${notObservedCaseIds[index]} should honestly report the unavailable request-ID observation`,
    );
  });

  const caseIds = [...passedCaseIds, ...notObservedCaseIds];
  for (const caseId of caseIds) {
    const evidenceToggleTestId = `desktop-sni-case-${caseId}-evidence-toggle`;
    const evidenceToggle = page.locator(
      `[data-testid="${evidenceToggleTestId}"]`,
    );
    await evidenceToggle.evaluate((element) => element.click());
    await page.waitForFunction(
      (testId) =>
        document
          .querySelector(`[data-testid="${testId}"]`)
          ?.textContent?.includes('Hide evidence'),
      evidenceToggleTestId,
      { timeout: APP_TIMEOUT_MS },
    );
  }
  const queuePanelText = await queuePanel.textContent();
  assert.equal(
    (
      await page
        .locator('[data-testid="desktop-sni-queue-fixed-target"]')
        .textContent()
    ).trim(),
    'wallet.onekeytest.com (104.18.31.39)/health',
    'desktop SNI QA page should display its fixed first-party target',
  );
  assert(
    queuePanelText.includes('Observed limiter peaks') &&
      queuePanelText.includes('Renderer outcomes') &&
      queuePanelText.includes('responded=40, cancelled=0, failed=0'),
    'desktop SNI QA page should display real 40-request outcomes and limiter observations',
  );
  assert(
    queuePanelText.includes('active state not observed') &&
      queuePanelText.includes('pending state not observed'),
    'desktop SNI QA page should disclose unavailable request-ID observations',
  );
  assert(
    queuePanelText.includes('cancelRequest acknowledgements') &&
      queuePanelText.includes('Raw transport outcomes'),
    'desktop SNI QA page should display real cancellation acknowledgements and transport outcomes',
  );
  assert(
    queuePanelText.includes('Recovery response') &&
      /Recovery responseHTTP [1-5]\d\d/u.test(queuePanelText),
    'desktop SNI queue panel should display the real recovery response',
  );
  await queuePanel.screenshot({
    path: path.join(artifactDir, 'sni-queue-panel.png'),
  });

  log(
    `SNI bridge smoke and QA page passed (${sniTarget.hostname} via ${sniTarget.ip}, smoke HTTP ${result.statusCode}, 7 UI cases)`,
  );
}

async function runFetchStreamSenderFlow() {
  const crypto = require('node:crypto');
  const { pathToFileURL } = require('node:url');
  const ts = require('typescript');
  const out = path.join(repoRoot, '.tmp', 'fetch-stream-electron');
  fs.mkdirSync(out, { recursive: true });
  const executablePath =
    process.env.DESKTOP_E2E_ELECTRON_PATH ||
    path.join(out, 'runtime', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  assert(
    fs.existsSync(executablePath),
    'Provide an isolated Electron executable',
  );
  const sourcePath = path.join(desktopDir, 'app', 'app.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const ast = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    ts.forEachChild(node, walk);
  };
  walk(ast);
  const counts = {};
  const fragments = {};
  const one = (name, predicate) => {
    const matches = nodes.filter(predicate);
    counts[name] = matches.length;
    assert.equal(matches.length, 1, `Production node ${name} must be unique`);
    fragments[name] = crypto
      .createHash('sha256')
      .update(matches[0].getText(ast))
      .digest('hex');
    return matches[0];
  };
  const text = (node) => node.getText(ast);
  const declaration = (name) =>
    one(
      name,
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
  const variable = (name) =>
    one(
      name,
      (node) =>
        ts.isVariableDeclaration(node) && node.name.getText(ast) === name,
    );
  const call = (name, expression, event) =>
    one(
      name,
      (node) =>
        ts.isCallExpression(node) &&
        text(node.expression) === expression &&
        (ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : text(node.arguments[0])) === event,
    );
  const transpile = (input) =>
    ts.transpileModule(input, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
  const configSource = fs.readFileSync(
    path.join(desktopDir, 'app/config.ts'),
    'utf8',
  );
  const configAst = ts.createSourceFile(
    'config.ts',
    configSource,
    ts.ScriptTarget.Latest,
    true,
  );
  const channels = [];
  const visitConfig = (node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(configAst) === 'FETCH_STREAM'
    )
      channels.push(node);
    ts.forEachChild(node, visitConfig);
  };
  visitConfig(configAst);
  assert.equal(channels.length, 1);
  const streamChannel = channels[0].initializer.text;
  const protocol = text(variable('PROTOCOL').initializer);
  const sharedPath = path.join(
    repoRoot,
    'packages/shared/src/utils/fetchStream.ts',
  );
  const helperPath = path.join(
    desktopDir,
    'app/libs/desktopApiModuleAllowlist.ts',
  );
  const extracted = {};
  const extractFrom = (filename, names) => {
    const raw = fs.readFileSync(filename, 'utf8');
    const tree = ts.createSourceFile(
      filename,
      raw,
      ts.ScriptTarget.Latest,
      true,
    );
    return names
      .map((name) => {
        const matches = [];
        const visit = (node) => {
          if (
            (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
            (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
          )
            matches.push(node);
          ts.forEachChild(node, visit);
        };
        visit(tree);
        assert.equal(
          matches.length,
          1,
          `Dependency node ${name} must be unique`,
        );
        const node = matches[0];
        const value = node.getText(tree);
        extracted[name] = {
          file: path.relative(repoRoot, filename),
          count: matches.length,
          sha256: crypto.createHash('sha256').update(value).digest('hex'),
        };
        return ts.isVariableDeclaration(node) ? `const ${value};` : value;
      })
      .join('\n');
  };
  const dependencySource = [
    extractFrom(sharedPath, [
      'createFetchStreamHandler',
      'FETCH_STREAM_CHUNK_BYTES',
      'FETCH_STREAM_MAX_ACTIVE',
    ]),
    extractFrom(helperPath, ['isTrustedMainWindowUrl']),
    extractFrom(
      path.join(repoRoot, 'packages/shared/src/utils/bufferUtils.ts'),
      ['toBuffer', 'bytesToBase64', 'base64ToBytes'],
    ),
    extractFrom(path.join(repoRoot, 'packages/shared/src/utils/hexUtils.ts'), [
      'hasHexPrefix',
      'stripHexPrefix',
    ]),
    extractFrom(path.join(repoRoot, 'packages/shared/src/utils/miscUtils.ts'), [
      'generateUUID',
    ]),
    extractFrom(
      path.join(repoRoot, 'packages/shared/src/utils/fetchWithIdleTimeout.ts'),
      ['FETCH_REQUEST_IDLE_TIMEOUT_MS', 'FETCH_RESPONSE_MAX_BYTES'],
    ),
  ].join('\n');
  fs.writeFileSync(
    path.join(out, 'production.cjs'),
    `const {Buffer}=require('node:buffer');
    const uuid=require(${JSON.stringify(require.resolve('react-native-uuid/dist'))}).default;
    const {isString}=require(${JSON.stringify(require.resolve('lodash'))});
    class OneKeyLocalError extends Error {} // Fixture-only: error classification/i18n are not under test.
    const streamingFetch=globalThis.fetch;
    ${transpile(dependencySource)}
    const hexUtils={stripHexPrefix};
    const bufferUtils={bytesToBase64,base64ToBytes};
    module.exports={createFetchStreamHandler,isTrustedMainWindowUrl};`,
  );
  const shellState = [
    'selectedShellDocumentCommitted',
    'trustedSameDocumentRouteUrl',
  ]
    .map((name) => `let ${text(variable(name))};`)
    .join('\n');
  const predicate = one(
    'sender-predicate',
    (node) =>
      ts.isBinaryExpression(node) &&
      text(node.left) ===
        'globalThis.$desktopMainAppFunctions.isTrustedMainWindowSender',
  );
  const navigation = [
    'did-navigate',
    'did-navigate-in-page',
    'will-navigate',
    'will-redirect',
    'will-frame-navigate',
  ]
    .map(
      (event) => `${text(call(event, 'browserWindow.webContents.on', event))};`,
    )
    .join('\n');
  const registration = text(
    call(
      'fetch-stream-handler',
      'ipcMain.handle',
      'ipcMessageKeys.FETCH_STREAM',
    ),
  );
  const safeMain = `const ${text(variable('getSafelyMainWindow'))};`;
  const safeWindow = `const ${text(variable('getSafelyBrowserWindow'))};`;
  const guard = `const ${text(variable('guardMainWindowNavigation'))};`;
  const closed = `${text(call('window-closed', 'browserWindow.on', 'closed'))};`;
  const relay = `const ${text(variable('fetchStreamRequest'))};`;
  const callbacks = transpile(
    [
      safeMain,
      text(declaration('showMainWindow')),
      text(declaration('createMainWindow')),
      text(declaration('softRestartRenderer')),
    ].join('\n'),
  );
  const factoryCallbacks = transpile(
    [
      safeWindow,
      shellState,
      `${text(predicate)};`,
      guard,
      navigation,
      closed,
      relay,
      'ipcMain.removeHandler(ipcMessageKeys.FETCH_STREAM);',
      `${registration};`,
    ].join('\n'),
  );
  const provenance = {
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    counts,
    fragments,
    extracted,
    streamChannel,
    sharedSha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(sharedPath))
      .digest('hex'),
    helperSha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(helperPath))
      .digest('hex'),
    scope:
      'Production callbacks in an isolated real Electron host; fixture window factory, no wallet or OTA verification',
  };
  fs.writeFileSync(
    path.join(out, 'provenance.json'),
    JSON.stringify(provenance, null, 2),
  );
  const preload = `const {contextBridge,ipcRenderer}=require('electron');
    contextBridge.exposeInMainWorld('fixture', {invoke:r=>ipcRenderer.invoke(${JSON.stringify(streamChannel)},r),control:r=>ipcRenderer.invoke('fixture-control',r)});
    ipcRenderer.invoke(${JSON.stringify(streamChannel)},{action:'cancel',id:'preload-probe'}).then(result=>ipcRenderer.send('fixture-observation',{kind:'preload-probe',url:location.href,result}));`;
  fs.writeFileSync(path.join(out, 'preload.cjs'), preload);
  const html = (
    label,
  ) => `<!doctype html><meta charset="utf-8"><title>${label}</title><h1>${label}</h1><p id="status">ready</p>
    <button id="hash">Hash + immediate IPC</button><button id="history">History + immediate IPC</button><button id="reload">Reload</button><button id="restart">Soft restart</button><iframe src="child.html"></iframe>
    <script>globalThis.results={}; for(const name of ['hash','history'])document.getElementById(name).onclick=async()=>{if(name==='hash')location.hash='route';else history.pushState({},'',document.title==='development'?'/dev/route':location.pathname+'?route=history');results[name]=await globalThis.fixture.invoke({action:'cancel',id:name});document.getElementById('status').textContent=name+':'+JSON.stringify(results[name]);};document.getElementById('reload').onclick=()=>location.reload();document.getElementById('restart').onclick=()=>globalThis.fixture.control('restart');</script>`;
  for (const dir of ['packaged', 'ota']) {
    fs.mkdirSync(path.join(out, dir), { recursive: true });
    fs.writeFileSync(path.join(out, dir, 'index.html'), html(dir));
    fs.writeFileSync(
      path.join(out, dir, 'child.html'),
      '<!doctype html><title>child</title><p>child</p>',
    );
  }
  fs.writeFileSync(path.join(out, 'foreign.html'), html('foreign'));
  fs.writeFileSync(path.join(out, 'child.html'), '<title>child</title>');
  const mainSource = `const {app,BrowserWindow,ipcMain,net,session}=require('electron');
    const fs=require('node:fs'),path=require('node:path');
    const OUT=${JSON.stringify(out)};
    fs.mkdirSync(path.join(OUT,'cache'),{recursive:true});
    app.setPath('userData',path.join(OUT,'user-data'));app.setPath('sessionData',path.join(OUT,'session-data'));app.setPath('cache',path.join(OUT,'cache'));
    const {createFetchStreamHandler,isTrustedMainWindowUrl}=require('./production.cjs');
    const events=[]; const record=(kind,data={})=>{events.push({time:Date.now(),kind,...data});fs.writeFileSync(path.join(OUT,'events.json'),JSON.stringify(events,null,2));};
    const logger={info:(...args)=>record('info',{args}),warn:(...args)=>record('warn',{args}),error:(...args)=>record('error',{args})};
    let mainWindow=null,createMainWindowPromise=null,softRestarting=false,isAppReady=false;
    let selectedDev=false;let selectedSrc=${JSON.stringify(pathToFileURL(path.join(out, 'packaged/index.html')).href)};
    const store={getUpdateBundleData:()=>({bundleVersion:'fixture'}),resetConsecutiveBootFailCount:()=>{}};
    const unregisterShortcuts=()=>{},getTrayWindow=()=>null,destroyTrayWindow=()=>{},PROTOCOL=${protocol};
    const ipcMessageKeys={FETCH_STREAM:${JSON.stringify(streamChannel)}};
    globalThis.$desktopMainAppFunctions={getBundleIndexHtmlPath:()=>selectedSrc};
    ${callbacks}
    async function createMainWindowImpl(){
      const src=selectedSrc,isDevServer=selectedDev;
      const browserWindow=new BrowserWindow({width:900,height:650,show:true,webPreferences:{preload:path.join(OUT,'preload.cjs'),webSecurity:true,contextIsolation:true,sandbox:true,nodeIntegration:false,nodeIntegrationInSubFrames:true}});
      mainWindow=browserWindow;
      browserWindow.webContents.on('render-process-gone',(_event,details)=>record('render-process-gone',details));
      for(const name of ['did-navigate','did-navigate-in-page','did-finish-load','destroyed'])browserWindow.webContents.on(name,(_event,url)=>record(name,{id:browserWindow.id,url}));
      ${factoryCallbacks}
      await browserWindow.loadURL('about:blank');
      await new Promise(resolve=>setTimeout(resolve,150));
      await browserWindow.loadURL(src);
      return browserWindow;
    }
    const originalHandle=ipcMain.handle.bind(ipcMain);
    ipcMain.handle=(channel,handler)=>originalHandle(channel,async(event,request)=>{
      let details={channel,request};try{const frame=event.senderFrame;details={...details,senderId:event.sender.id,frameUrl:frame?.url,frameProcessId:frame?.processId,frameRoutingId:frame?.routingId,mainFrame:frame===event.sender.mainFrame};}catch(error){details.frameObservationError=String(error);}
      record('ipc-start',details);const result=await handler(event,request);record('ipc-result',{...details,result});return result;
    });
    ipcMain.on('fixture-observation',(_event,data)=>record('renderer-observation',data));
    originalHandle('fixture-control',async(_event,action)=>{if(action==='restart'){selectedSrc=${JSON.stringify(pathToFileURL(path.join(out, 'ota/index.html')).href)};setTimeout(()=>void softRestartRenderer(),0);return true;}});
    globalThis.fixtureHost={events,selectDev:async(url)=>{selectedSrc=url;selectedDev=true;await softRestartRenderer();return true;},ready:async()=>{await createMainWindowPromise;return true;},getWindow:()=>mainWindow,createForeign:async()=>{const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(OUT,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});await w.loadURL(${JSON.stringify(pathToFileURL(path.join(out, 'foreign.html')).href)});return w.id;}};
    app.whenReady().then(()=>createMainWindow()).catch(error=>{console.error(error);app.exit(1)});
    app.on('window-all-closed',()=>{});`;
  fs.writeFileSync(path.join(out, 'main.cjs'), mainSource);
  const requests = [];
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/dev/')) {
      response.writeHead(200, {
        'content-type': 'text/html',
        'cache-control': 'no-store',
      });
      response.end(
        request.url === '/dev/child.html'
          ? '<title>child</title>'
          : html('development'),
      );
      return;
    }
    const entry = { url: request.url, time: Date.now(), closed: false };
    requests.push(entry);
    response.on('close', () => {
      entry.closed = true;
      entry.closedAt = Date.now();
    });
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    });
    if (request.url.startsWith('/slow?')) {
      response.write('first'.repeat(1024));
      const timer = setInterval(() => response.write('more'), 100);
      response.on('close', () => clearInterval(timer));
    } else response.end('fixture-response');
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let instance;
  const results = [];
  try {
    instance = await electron.launch({
      executablePath,
      args: [
        path.join(out, 'main.cjs'),
        `--user-data-dir=${path.join(out, 'user-data')}`,
      ],
      cwd: out,
      env: { ...process.env, TMPDIR: out, ELECTRON_RUN_AS_NODE: undefined },
      timeout: 30_000,
    });
    instance
      .process()
      .stderr.on('data', (data) =>
        fs.appendFileSync(path.join(out, 'electron-stderr.log'), data),
      );
    await instance.evaluate(async () => globalThis.fixtureHost.ready());
    let page = await instance.firstWindow();
    const ready = async (target, label) => {
      await target.waitForURL(`**/${label}/index.html*`);
      await target.locator('h1').filter({ hasText: label }).waitFor();
      assert.equal(await target.title(), label);
    };
    await ready(page, 'packaged');
    const roundtrip = async (target, label) => {
      const value = await target.evaluate(
        async (url) => {
          const opened = await globalThis.fixture.invoke({
            action: 'open',
            url,
          });
          if (!opened.ok) return { opened };
          let body = '',
            done = false;
          for (let i = 0; i < 10; i += 1) {
            const next = await globalThis.fixture.invoke({
              action: 'read',
              id: opened.response.id,
            });
            if (!next.ok) return { opened, next };
            body += atob(next.chunk.b64);
            if (next.chunk.done) {
              done = true;
              break;
            }
          }
          return { opened, body, done };
        },
        `${base}/bytes?case=${encodeURIComponent(label)}`,
      );
      assert.equal(value.opened.ok, true, `${label} first open`);
      assert.equal(value.body, 'fixture-response');
      assert.equal(value.done, true);
      results.push({ label, ...value });
      const cancelled = await target.evaluate(
        async (url) => {
          const opened = await globalThis.fixture.invoke({
            action: 'open',
            url,
          });
          if (!opened.ok) return { opened };
          return {
            opened,
            cancelled: await globalThis.fixture.invoke({
              action: 'cancel',
              id: opened.response.id,
            }),
          };
        },
        `${base}/slow?case=${encodeURIComponent(label)}`,
      );
      assert.equal(cancelled.opened.ok, true);
      assert.equal(cancelled.cancelled.cancelled, true);
      const slow = requests
        .filter(
          (entry) => entry.url === `/slow?case=${encodeURIComponent(label)}`,
        )
        .at(-1);
      assert(slow);
      for (let n = 0; n < 30 && !slow.closed; n += 1)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        slow.closed,
        true,
        'cancel must close the real server response',
      );
    };
    await roundtrip(page, 'cold committed');
    for (const action of ['hash', 'history']) {
      await page.locator(`#${action}`).click();
      await page.waitForFunction((name) => globalThis.results[name], action);
      assert.deepEqual(
        await page.evaluate((name) => globalThis.results[name], action),
        { ok: true, cancelled: true },
      );
      await roundtrip(page, `${action} immediate then stream`);
      await page.screenshot({ path: path.join(out, `${action}-success.png`) });
      if (action === 'hash') {
        const abandoned = await page.evaluate(
          (url) => globalThis.fixture.invoke({ action: 'open', url }),
          `${base}/slow?case=abandoned-before-reload`,
        );
        assert.equal(abandoned.ok, true);
        const navigated = page.waitForEvent('load');
        await page.locator('#reload').click();
        await navigated;
        await ready(page, 'packaged');
        await roundtrip(page, 'reload');
        const retained = await page.evaluate(
          (id) => globalThis.fixture.invoke({ action: 'read', id }),
          abandoned.response.id,
        );
        assert.equal(retained.ok, true);
        assert.equal(retained.chunk.done, false);
        const idleStarted = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 31_000));
        const expired = await page.evaluate(
          (id) => globalThis.fixture.invoke({ action: 'read', id }),
          abandoned.response.id,
        );
        assert.equal(expired.ok, false);
        assert.equal(expired.error, 'fetch stream expired or closed');
        assert.equal(
          requests.find(
            (entry) => entry.url === '/slow?case=abandoned-before-reload',
          ).closed,
          true,
        );
        results.push({
          label: 'reload retains old stream until real default idle expiry',
          idleWaitMs: Date.now() - idleStarted,
          retained,
          expired,
        });
      }
    }
    const beforeQueryReload = await instance.evaluate(
      () => globalThis.fixtureHost.events.length,
    );
    await page.locator('#reload').click({ noWaitAfter: true });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const queryEvents = await instance.evaluate(
      () => globalThis.fixtureHost.events.slice(),
      beforeQueryReload,
    );
    assert(
      queryEvents
        .slice(beforeQueryReload)
        .some(
          (event) =>
            event.kind === 'warn' &&
            event.args[0].includes('rejected navigation'),
        ),
    );
    assert(page.url().includes('?route=history'));
    assert.deepEqual(
      await page.evaluate(() =>
        globalThis.fixture.invoke({
          action: 'cancel',
          id: 'after-blocked-query-reload',
        }),
      ),
      { ok: true, cancelled: true },
    );
    results.push({
      label:
        'file query full reload rejected by existing guard; live IPC remains allowed',
    });
    const beforeForeignLoad = requests.length;
    await instance.evaluate(
      async (_electron, url) => {
        await globalThis.fixtureHost
          .getWindow()
          .loadURL(url)
          .catch(() => {});
      },
      pathToFileURL(path.join(out, 'foreign.html')).href,
    );
    await ready(page, 'packaged');
    assert.equal(requests.length, beforeForeignLoad);
    results.push({
      label:
        'untrusted full file commit revoked sender and restored selected shell',
    });
    const beforeChild = requests.length;
    const child = page.frames().find((frame) => frame !== page.mainFrame());
    assert(child);
    assert.deepEqual(
      await child.evaluate(
        (url) => globalThis.fixture.invoke({ action: 'open', url }),
        `${base}/child-forbidden`,
      ),
      { ok: false, error: 'not allowed' },
    );
    assert.equal(requests.length, beforeChild);
    results.push({ label: 'real child frame IPC denied' });
    const beforeForeign = requests.length;
    await instance.evaluate(async () => globalThis.fixtureHost.createForeign());
    const foreign = instance.windows().find((candidate) => candidate !== page);
    assert.deepEqual(
      await foreign.evaluate(
        (url) => globalThis.fixture.invoke({ action: 'open', url }),
        `${base}/foreign`,
      ),
      { ok: false, error: 'not allowed' },
    );
    assert.equal(requests.length, beforeForeign);
    results.push({ label: 'foreign window IPC denied without network' });
    const oldId = await instance.evaluate(
      () => globalThis.fixtureHost.getWindow().webContents.id,
    );
    const newWindow = instance.waitForEvent('window');
    await page.locator('#restart').click();
    page = await newWindow;
    await ready(page, 'ota');
    await roundtrip(page, 'soft restart');
    assert.equal(
      (await instance.evaluate(
        () => globalThis.fixtureHost.getWindow().webContents.id,
      )) === oldId,
      false,
    );
    assert(
      await instance.evaluate(
        ({ webContents }, id) => webContents.fromId(id) === undefined,
        oldId,
      ),
    );
    results.push({
      label:
        'production softRestart callback replaced and destroyed old webContents',
    });
    await page.screenshot({ path: path.join(out, 'ota-success.png') });
    const developmentWindow = instance.waitForEvent('window');
    await instance.evaluate(
      (_electron, url) => globalThis.fixtureHost.selectDev(url),
      `${base}/dev/index.html`,
    );
    page = await developmentWindow;
    await page.locator('h1').filter({ hasText: 'development' }).waitFor();
    assert.equal(await page.title(), 'development');
    await page.locator('#history').click();
    await page.waitForFunction(() => globalThis.results.history);
    assert.deepEqual(await page.evaluate(() => globalThis.results.history), {
      ok: true,
      cancelled: true,
    });
    await roundtrip(page, 'development pathname immediate IPC');
    const devReload = page.waitForEvent('load');
    await page.locator('#reload').click();
    await devReload;
    await page.locator('h1').filter({ hasText: 'development' }).waitFor();
    await roundtrip(page, 'development observed pathname reload');
    await page.screenshot({ path: path.join(out, 'development-success.png') });
    const events = await instance.evaluate(() => globalThis.fixtureHost.events);
    assert(
      events.some(
        (event) =>
          event.kind === 'ipc-result' &&
          event.frameUrl === 'about:blank' &&
          event.result.error === 'not allowed',
      ),
    );
    results.push({
      label: 'real about:blank IPC denied before selected shell commit',
    });
    assert.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(sourcePath))
        .digest('hex'),
      provenance.sourceSha256,
    );
    assert(
      events.some(
        (event) =>
          event.kind === 'ipc-result' &&
          event.senderId ===
            events.find(
              (item) =>
                item.kind === 'ipc-result' && item.frameUrl === 'about:blank',
            ).senderId &&
          event.frameUrl ===
            pathToFileURL(path.join(out, 'foreign.html')).href &&
          event.result.ok === false &&
          event.result.error === 'not allowed',
      ),
    );
    assert(
      events.some(
        (event) =>
          event.kind === 'ipc-result' &&
          event.request.url === `${base}/child-forbidden` &&
          event.mainFrame === false &&
          event.result.ok === false,
      ),
    );
    assert.equal(requests.length, 15);
    assert.equal(new Set(requests.map((request) => request.url)).size, 15);
    assert.equal(results.length, 14);
    assert(!events.some((event) => event.kind === 'render-process-gone'));
    fs.writeFileSync(
      path.join(out, 'summary.json'),
      JSON.stringify(
        {
          passed: true,
          caseCount: results.length,
          failed: 0,
          versions: await instance.evaluate(() => process.versions),
          results,
          requests,
          provenance,
          limitations: [
            'Fixture window factory; no complete wallet boot or OTA verification',
            'Subframe preload enabled only for negative IPC fixture',
            'ERR_ABORTED from recovery away from an untrusted file is an expected fixture navigation result',
            'Window-all-closed and quitOrMinimize full App behavior are not exercised',
            'Packaged history query is tested as same-document only; its full reload is rejected by the existing navigation policy',
            'OneKey error classification/i18n and complete bootstrap are outside this fixture',
            'Default 30s idle expiry is waited in real time; no stream ownership is assigned to documents',
          ],
        },
        null,
        2,
      ),
    );
    log(`FETCH_STREAM real Electron passed; evidence: ${out}`);
  } catch (error) {
    fs.writeFileSync(
      path.join(out, 'failure.json'),
      JSON.stringify({ error: String(error), results, requests }, null, 2),
    );
    if (instance) {
      const pages = instance.windows();
      await pages[0]
        ?.screenshot({ path: path.join(out, 'failure.png') })
        .catch(() => {});
    }
    throw error;
  } finally {
    try {
      if (instance) await instance.close();
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

async function main() {
  if (desktopE2EFlow === 'fetch-stream-sender') {
    await runFetchStreamSenderFlow();
    return;
  }
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
