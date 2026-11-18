#!/usr/bin/env node

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { rspack } = require('@rspack/core');
const { chromium } = require('playwright-core');

const {
  findChromiumExecutable,
} = require('../../../development/perf-ci/lib/chromium');

const V_664 = '6640000000000000000000000000000000000000-100';
const V_670 = '6700000000000000000000000000000000000000-200';
const V_680 = '6800000000000000000000000000000000000000-300';

const UNITAS_PATH_AND_QUERY =
  '/earn/bsc/XAUt/unitas?vault=0x0a4db0575ce1518ba1d008cf7cc08aeb05f57b0e&utm_source=onekey_email&utm_medium=email&utm_campaign=unitas_xaut_45d&utm_content=xaut_card_cta';
const NEW_CAMPAIGN_PATH_AND_QUERY = '/new-campaign-v680?utm_source=email';

function computeSha384Integrity(content) {
  const digest = createHash('sha384')
    .update(Buffer.from(content, 'utf8'))
    .digest('base64');
  return `sha384-${digest}`;
}

async function compileServiceWorkerBundle(outDir) {
  const swEntry = path.resolve(__dirname, '../src/service-worker.js');
  await new Promise((resolve, reject) => {
    const compiler = rspack({
      mode: 'production',
      entry: {
        'service-worker': swEntry,
      },
      output: {
        path: outDir,
        filename: '[name].js',
      },
      resolve: {
        extensions: ['.web.ts', '.web.js', '.ts', '.tsx', '.js', '.json'],
      },
      plugins: [
        new rspack.DefinePlugin({
          'self.__WB_MANIFEST': JSON.stringify([]),
        }),
      ],
      module: {
        rules: [
          {
            test: /\.[jt]sx?$/,
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
              },
            },
          },
        ],
      },
    });
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (stats?.hasErrors()) {
        reject(
          new Error(
            stats.toString({
              errors: true,
              errorDetails: true,
            }),
          ),
        );
        return;
      }
      compiler.close((closeErr) => (closeErr ? reject(closeErr) : resolve()));
    });
  });

  execFileSync(
    process.execPath,
    [
      path.resolve(__dirname, '../scripts/validate-built-service-worker.mjs'),
      outDir,
    ],
    { stdio: 'inherit' },
  );

  return fs.readFileSync(path.join(outDir, 'service-worker.js'), 'utf8');
}

function buildLegacyV664ClientScript() {
  return `
(function () {
  const CURRENT_VERSION = ${JSON.stringify(V_664)};
  let pendingVersionActivation = '';

  function showUpdateBanner(onRefresh) {
    document.getElementById('sw-update-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.textContent = 'App 新版本可供更新';
    const btn = document.createElement('button');
    btn.id = 'sw-refresh-btn';
    btn.textContent = '刷新';
    btn.onclick = () => (onRefresh ? onRefresh() : window.location.reload());
    banner.appendChild(btn);
    document.body.appendChild(banner);
  }

  function postMessageToServiceWorker(type, payload = {}) {
    navigator.serviceWorker.controller?.postMessage({
      type,
      payload: {
        clientVersion: CURRENT_VERSION,
        ...payload,
      },
    });
  }

  function activateReadyVersion(version) {
    if (!version) {
      window.location.reload();
      return;
    }
    pendingVersionActivation = version;
    postMessageToServiceWorker('ACTIVATE_VERSION', { version });
  }

  function requestServiceWorkerVersionCheck() {
    if (!navigator.serviceWorker.controller) return;
    postMessageToServiceWorker('GET_VERSION_STATE');
    postMessageToServiceWorker('CHECK_VERSION');
  }

  function setupServiceWorkerVersionProtocol() {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data?.type;
      const payload = event.data?.payload || {};
      if (type === 'UPDATE_READY') {
        if (payload.version && pendingVersionActivation !== payload.version) {
          showUpdateBanner(() => activateReadyVersion(payload.version));
        }
      }
      if (type === 'VERSION_STATE') {
        if (payload.activeVersion && payload.activeVersion !== CURRENT_VERSION) {
          showUpdateBanner(() => window.location.reload());
          return;
        }
        if (payload.readyVersion && pendingVersionActivation !== payload.readyVersion) {
          showUpdateBanner(() => activateReadyVersion(payload.readyVersion));
        }
      }
      if (type === 'VERSION_ACTIVATED') {
        const version = payload.version;
        if (pendingVersionActivation === version) {
          pendingVersionActivation = '';
          window.location.reload();
          return;
        }
        if (version && version !== CURRENT_VERSION) {
          showUpdateBanner(() => window.location.reload());
        }
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      requestServiceWorkerVersionCheck();
    });
    requestServiceWorkerVersionCheck();
  }

  function renderApp() {
    const pathname = window.location.pathname;
    if (pathname.toLowerCase().includes('/unitas')) {
      document.body.innerHTML = '<div data-testid="error-boundary">发生了未知错误，请再试一次。</div>';
      return;
    }
    document.body.innerHTML = '<div data-testid="v664-home">v6.6.4 Home</div>';
  }

  window.addEventListener('load', () => {
    renderApp();
    navigator.serviceWorker
      .register('/service-worker.js?tradingviewEmbedProtocol=1&appBuild=' + encodeURIComponent(CURRENT_VERSION), {
        scope: '/',
        updateViaCache: 'none',
      })
      .then(() => {
        setupServiceWorkerVersionProtocol();
        navigator.serviceWorker.ready.then(() => requestServiceWorkerVersionCheck());
      });
  });
})();
`;
}

function buildV670ClientScript() {
  return `
(function () {
  const CURRENT_VERSION = ${JSON.stringify(V_670)};
  const AUTO_RELOAD_STORAGE_KEY = '__onekey_sw_error_auto_reload__';
  const WEB_ROUTE_NOT_FOUND_EVENT = 'onekey-web-route-not-found';
  let pendingVersionActivation = '';
  let hasRootPageError = false;
  let isAutoReloading = false;
  let latestReadyVersion = '';
  let latestActiveVersion = '';

  function isPageInErrorState() {
    return Boolean(hasRootPageError || window.__onekeyWebRouteNotFound);
  }

  function getAutoReloadTargetKey(version) {
    return version + ':' + (window.location.pathname || '/');
  }

  function hasAlreadyAutoReloadedForVersion(version) {
    if (!version) return false;
    return window.sessionStorage.getItem(AUTO_RELOAD_STORAGE_KEY) === getAutoReloadTargetKey(version);
  }

  function markAutoReloadedForVersion(version) {
    if (!version) return;
    window.sessionStorage.setItem(AUTO_RELOAD_STORAGE_KEY, getAutoReloadTargetKey(version));
  }

  function showUpdateBanner(onRefresh) {
    if (isAutoReloading) return;
    document.getElementById('sw-update-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.textContent = 'App 新版本可供更新';
    const btn = document.createElement('button');
    btn.id = 'sw-refresh-btn';
    btn.textContent = '刷新';
    btn.onclick = () => (onRefresh ? onRefresh() : window.location.reload());
    banner.appendChild(btn);
    document.body.appendChild(banner);
  }

  function postMessageToServiceWorker(type, payload = {}) {
    navigator.serviceWorker.controller?.postMessage({
      type,
      payload: {
        clientVersion: CURRENT_VERSION,
        clientAutoReloadCapable: true,
        hasPageError: isPageInErrorState(),
        ...payload,
      },
    });
  }

  function activateReadyVersion(version) {
    if (!version) {
      window.location.reload();
      return;
    }
    pendingVersionActivation = version;
    postMessageToServiceWorker('ACTIVATE_VERSION', { version });
  }

  function triggerAutoReloadForVersion(version, shouldActivateReady) {
    isAutoReloading = true;
    if (version) markAutoReloadedForVersion(version);
    document.getElementById('sw-update-banner')?.remove();
    if (shouldActivateReady && version) {
      activateReadyVersion(version);
      return;
    }
    window.location.reload();
  }

  function requestServiceWorkerVersionCheck() {
    if (!navigator.serviceWorker.controller) return;
    postMessageToServiceWorker('GET_VERSION_STATE');
    postMessageToServiceWorker('CHECK_VERSION');
  }

  function markPageErrorAndTryAutoReload() {
    hasRootPageError = true;
    if (isAutoReloading) return true;
    if (
      latestActiveVersion &&
      latestActiveVersion !== CURRENT_VERSION &&
      !hasAlreadyAutoReloadedForVersion(latestActiveVersion)
    ) {
      triggerAutoReloadForVersion(latestActiveVersion, false);
      return true;
    }
    if (
      latestReadyVersion &&
      latestReadyVersion !== CURRENT_VERSION &&
      !hasAlreadyAutoReloadedForVersion(latestReadyVersion)
    ) {
      triggerAutoReloadForVersion(latestReadyVersion, true);
      return true;
    }
    requestServiceWorkerVersionCheck();
    return false;
  }

  function showReadyVersionBanner(version) {
    if (!version || pendingVersionActivation === version || isAutoReloading) return;
    latestReadyVersion = version;
    if (
      isPageInErrorState() &&
      version !== CURRENT_VERSION &&
      !hasAlreadyAutoReloadedForVersion(version)
    ) {
      triggerAutoReloadForVersion(version, true);
      return;
    }
    showUpdateBanner(() => activateReadyVersion(version));
  }

  function showActivatedVersionBanner(version) {
    if (!version || version === CURRENT_VERSION) return false;
    if (isAutoReloading) return true;
    latestActiveVersion = version;
    if (isPageInErrorState() && !hasAlreadyAutoReloadedForVersion(version)) {
      triggerAutoReloadForVersion(version, false);
      return true;
    }
    showUpdateBanner(() => window.location.reload());
    return true;
  }

  function setupServiceWorkerVersionProtocol() {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data?.type;
      const payload = event.data?.payload || {};
      if (type === 'UPDATE_READY') {
        showReadyVersionBanner(payload.version);
      }
      if (type === 'VERSION_STATE') {
        if (payload.activeVersion && showActivatedVersionBanner(payload.activeVersion)) {
          return;
        }
        if (payload.readyVersion) {
          showReadyVersionBanner(payload.readyVersion);
        }
      }
      if (type === 'VERSION_ACTIVATED') {
        const version = payload.version;
        if (
          (version && pendingVersionActivation === version) ||
          (payload.autoReload &&
            version &&
            version !== CURRENT_VERSION &&
            !hasAlreadyAutoReloadedForVersion(version))
        ) {
          pendingVersionActivation = '';
          triggerAutoReloadForVersion(version, false);
          return;
        }
        showActivatedVersionBanner(version);
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      requestServiceWorkerVersionCheck();
    });
    requestServiceWorkerVersionCheck();
  }

  window.addEventListener(WEB_ROUTE_NOT_FOUND_EVENT, () => {
    markPageErrorAndTryAutoReload();
  });

  function renderApp() {
    const pathname = window.location.pathname;
    if (pathname === '/earn/bsc/XAUt/unitas') {
      document.body.innerHTML =
        '<div data-testid="unitas-xaut-detail">Unitas XAUt Vault: ' +
        window.location.search +
        '</div>';
      return;
    }
    if (pathname === '/' || pathname === '/swap') {
      document.body.innerHTML = '<div data-testid="v670-home">v6.7.0 Home</div>';
      return;
    }
    // Unmatched route (NotFound) in v6.7.0: preserve URL and fire route-not-found
    window.__onekeyWebRouteNotFound = true;
    document.body.innerHTML = '<div data-testid="not-found">NotFound</div>';
    window.dispatchEvent(new Event(WEB_ROUTE_NOT_FOUND_EVENT));
  }

  window.addEventListener('load', () => {
    renderApp();
    navigator.serviceWorker
      .register('/service-worker.js?tradingviewEmbedProtocol=1&appBuild=' + encodeURIComponent(CURRENT_VERSION), {
        scope: '/',
        updateViaCache: 'none',
      })
      .then(() => {
        setupServiceWorkerVersionProtocol();
        navigator.serviceWorker.ready.then(() => requestServiceWorkerVersionCheck());
      });
  });
})();
`;
}

function buildV680ClientScript() {
  return `
(function () {
  window.addEventListener('load', () => {
    const pathname = window.location.pathname;
    if (pathname === '/new-campaign-v680') {
      document.body.innerHTML =
        '<div data-testid="campaign-v680-page">v6.8.0 Campaign: ' +
        window.location.search +
        '</div>';
      return;
    }
    document.body.innerHTML = '<div data-testid="v680-home">v6.8.0 Home</div>';
  });
})();
`;
}

function createReleaseArtifacts({
  version,
  buildTime,
  scriptName,
  scriptContent,
}) {
  const integrity = computeSha384Integrity(scriptContent);
  const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/${scriptName}" integrity="${integrity}" crossorigin="anonymous"></script></head><body></body></html>`;
  const manifest = {
    schema: 1,
    version,
    appVersion: '6.7.0',
    bundleVersion: '200',
    buildNumber: version.split('-')[1] || '0',
    commit: version.split('-')[0] || 'local',
    buildTime,
    publicUrl: '/',
    htmlUrl: '/index.html',
    generatedAt: new Date(buildTime).toISOString(),
    critical: [
      {
        url: `/${scriptName}`,
        as: 'script',
        integrity,
        crossOrigin: 'anonymous',
        size: Buffer.byteLength(scriptContent, 'utf8'),
      },
    ],
  };
  return {
    html,
    manifest,
    scriptContent,
    scriptName,
  };
}

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-sw-e2e-'));
  let server;
  let context;

  try {
    const compiledSw = await compileServiceWorkerBundle(tmpDir);

    const releaseV664 = createReleaseArtifacts({
      version: V_664,
      buildTime: 1_700_000_000_000,
      scriptName: 'main.v664.js',
      scriptContent: buildLegacyV664ClientScript(),
    });
    const releaseV670 = createReleaseArtifacts({
      version: V_670,
      buildTime: 1_700_000_100_000,
      scriptName: 'main.v670.js',
      scriptContent: buildV670ClientScript(),
    });
    const releaseV680 = createReleaseArtifacts({
      version: V_680,
      buildTime: 1_700_000_200_000,
      scriptName: 'main.v680.js',
      scriptContent: buildV680ClientScript(),
    });

    const scriptsByName = new Map([
      [releaseV664.scriptName, releaseV664.scriptContent],
      [releaseV670.scriptName, releaseV670.scriptContent],
      [releaseV680.scriptName, releaseV680.scriptContent],
    ]);

    let activeRelease = releaseV664;

    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const { pathname } = reqUrl;

      if (pathname === '/service-worker.js') {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(compiledSw);
        return;
      }

      if (pathname === '/sw-version-manifest.json') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(activeRelease.manifest));
        return;
      }

      const scriptKey = pathname.replace(/^\//, '');
      if (scriptsByName.has(scriptKey)) {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(scriptsByName.get(scriptKey));
        return;
      }

      // SPA fallback to index.html for navigation routes
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(activeRelease.html);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const executablePath = findChromiumExecutable(
      process.env.WEB_E2E_BROWSER_EXECUTABLE,
    );
    context = await chromium.launchPersistentContext(
      path.join(tmpDir, 'profile'),
      {
        args: ['--no-sandbox'],
        ...(executablePath ? { executablePath } : {}),
        headless: true,
      },
    );
    context.setDefaultTimeout(20_000);

    const page = await context.newPage();

    // Step 1: Old user visits on v6.6.4 -> SW installs & caches v6.6.4
    await page.goto(`${baseUrl}/`);
    await page.getByTestId('v664-home').waitFor({ state: 'visible' });
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.active && navigator.serviceWorker.controller);
    });
    // Wait until v6.6.4 is recorded as activeVersion in SW state cache
    await page.waitForFunction(async () => {
      const cache = await caches.open('onekey-web-version-state');
      const res = await cache.match('/__onekey_web_version_state__');
      if (!res) return false;
      const state = await res.json();
      return Boolean(state.activeVersion);
    });

    // Step 2: Server publishes release/v6.7.0 (with Unitas)
    activeRelease = releaseV670;

    // Step 3: Old user clicks the Unitas email link -> initially hits cached v6.6.4,
    // then SW automatically activates v6.7.0 and reloads into the Unitas detail page!
    await page.goto(`${baseUrl}${UNITAS_PATH_AND_QUERY}`);
    await page.getByTestId('unitas-xaut-detail').waitFor({ state: 'visible' });

    const unitasText = await page
      .getByTestId('unitas-xaut-detail')
      .textContent();
    assert.ok(
      unitasText.includes('vault=0x0a4db0575ce1518ba1d008cf7cc08aeb05f57b0e'),
      `Expected Unitas vault query param to be preserved, got: ${unitasText}`,
    );
    assert.ok(
      unitasText.includes('utm_campaign=unitas_xaut_45d'),
      `Expected UTM campaign param to be preserved, got: ${unitasText}`,
    );
    assert.equal(await page.locator('#sw-update-banner').count(), 0);
    console.log(
      '[sw-e2e] Phase 1 PASS: v6.6.4 cached user opening v6.7.0 Unitas email link auto-reloaded into v6.7.0 with query params preserved',
    );

    // Step 4: Server publishes v6.8.0 (with new route /new-campaign-v680)
    activeRelease = releaseV680;

    // Step 5: User on v6.7.0 opens the new v6.8.0 route (which hits NotFound in v6.7.0)
    // -> v6.7.0 client preserves URL, auto-activates v6.8.0, and reloads into v6.8.0!
    await page.goto(`${baseUrl}${NEW_CAMPAIGN_PATH_AND_QUERY}`);
    await page.getByTestId('campaign-v680-page').waitFor({ state: 'visible' });
    const campaignText = await page
      .getByTestId('campaign-v680-page')
      .textContent();
    assert.ok(
      campaignText.includes('utm_source=email'),
      `Expected campaign query param to be preserved, got: ${campaignText}`,
    );
    assert.equal(await page.locator('#sw-update-banner').count(), 0);
    console.log(
      '[sw-e2e] Phase 2 PASS: v6.7.0 cached user opening v6.8.0 new route auto-reloaded into v6.8.0 with URL preserved',
    );
  } finally {
    await context?.close();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
