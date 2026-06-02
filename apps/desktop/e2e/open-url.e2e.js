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
const targetInput = process.env.DESKTOP_E2E_OPEN_URL || 'apple.com';
const targetUrl = toUrl(targetInput);
const expectedHost = stripWww(new URL(targetUrl).hostname);
const expectedContentText =
  process.env.DESKTOP_E2E_EXPECT_TEXT ||
  (expectedHost === 'apple.com' ? 'Apple' : expectedHost);

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
};

function log(message) {
  console.log(`[desktop-e2e] ${message}`);
}

function yarnBin() {
  return process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
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

function appendOutput(buffer, chunk) {
  const value = `${buffer}${chunk.toString()}`;
  return value.length > 8000 ? value.slice(value.length - 8000) : value;
}

function runYarn(args, { timeoutMs }) {
  log(`run: yarn ${args.join(' ')}`);
  const result = spawnSync(yarnBin(), args, {
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
  const child = spawn(
    yarnBin(),
    ['workspace', '@onekeyhq/desktop', 'exec', 'rspack', 'serve'],
    {
      cwd: repoRoot,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        ...desktopE2EEnv,
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

    await runBrowserOpenUrlFlow(app, page);
  } catch (error) {
    if (page) {
      const screenshotPath = path.join(artifactDir, 'open-url-failure.png');
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
