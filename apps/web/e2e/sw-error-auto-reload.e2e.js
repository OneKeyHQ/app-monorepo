#!/usr/bin/env node

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { pathToFileURL } = require('node:url');

const { rspack } = require('@rspack/core');
const { chromium } = require('playwright-core');

const {
  findChromiumExecutable,
} = require('../../../development/perf-ci/lib/chromium');
const {
  startStaticServer,
} = require('../../../development/perf-ci/lib/staticServer');

const {
  attachDiagnostics,
  logDiagnostics,
  logPageSnapshot,
} = require('./sw-error-auto-reload.diagnostics');

const UNITAS_PATH_AND_QUERY =
  '/earn/bsc/XAUt/unitas?vault=0x0a4db0575ce1518ba1d008cf7cc08aeb05f57b0e&utm_source=onekey_email&utm_medium=email&utm_campaign=unitas_xaut_45d&utm_content=xaut_card_cta';
const CAMPAIGN_PATH = '/new-campaign';
const CAMPAIGN_PATH_AND_QUERY = `${CAMPAIGN_PATH}?utm_source=email`;
const VERSION_STATE_CACHE = 'onekey-web-version-state';
const VERSION_STATE_PATH = '/__onekey_web_version_state__';
const E2E_TIMEOUT_MS = 20_000;

// These builds model client capabilities and are independent of the app release train.
const LEGACY_BUILD = describeBuild('legacy', 1);
const RECOVERY_BUILD = describeBuild('route-recovery', 2);
const CAMPAIGN_BUILD = describeBuild('campaign', 3);

function describeBuild(name, sequence) {
  const commit = String(sequence).repeat(40);
  const buildNumber = String(sequence * 100);
  return {
    name,
    commit,
    buildNumber,
    version: `${commit}-${buildNumber}`,
    appVersion: `0.0.${sequence}`,
    buildTime: 1_700_000_000_000 + sequence * 100_000,
    scriptName: `main.${name}.js`,
  };
}

function computeSha384Integrity(content) {
  const digest = createHash('sha384')
    .update(Buffer.from(content, 'utf8'))
    .digest('base64');
  return `sha384-${digest}`;
}

async function compileTestBundles(outDir) {
  const swEntry = path.resolve(__dirname, '../src/service-worker.js');
  await new Promise((resolve, reject) => {
    const compiler = rspack({
      mode: 'production',
      entry: {
        'service-worker': swEntry,
        [path.basename(RECOVERY_BUILD.scriptName, '.js')]: path.resolve(
          __dirname,
          'sw-error-auto-reload.fixture.js',
        ),
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
          'process.env.WEB_E2E_CLIENT_VERSION': JSON.stringify(
            RECOVERY_BUILD.version,
          ),
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

  const prevArgv2 = process.argv[2];
  process.argv[2] = outDir;
  try {
    await import(
      pathToFileURL(
        path.resolve(__dirname, '../scripts/validate-built-service-worker.mjs'),
      ).href
    );
  } finally {
    process.argv[2] = prevArgv2;
  }
}

function buildLegacyClientScript() {
  return `
(function () {
  const CURRENT_VERSION = ${JSON.stringify(LEGACY_BUILD.version)};
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
    setInterval(requestServiceWorkerVersionCheck, 250);
  }

  function renderTestView(testId, text) {
    const node = document.createElement('div');
    node.setAttribute('data-testid', testId);
    node.textContent = text;
    document.body.replaceChildren(node);
  }

  function renderApp() {
    const pathname = window.location.pathname;
    if (pathname.toLowerCase().includes('/unitas')) {
      renderTestView('error-boundary', '发生了未知错误，请再试一次。');
      return;
    }
    renderTestView('legacy-home', 'Legacy build home');
  }

  window.addEventListener('load', () => {
    renderApp();
    const scriptURL = '/service-worker.js?tradingviewEmbedProtocol=1&appBuild=' + encodeURIComponent(CURRENT_VERSION);
    console.info('[sw-fixture] Registering legacy service worker', scriptURL);
    navigator.serviceWorker
      .register(scriptURL, {
        scope: '/',
        updateViaCache: 'none',
      })
      .then(() => {
        setupServiceWorkerVersionProtocol();
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        requestServiceWorkerVersionCheck();
        document.documentElement.dataset.versionProtocolReady = 'true';
      })
      .catch((error) => {
        console.error('[sw-fixture] Legacy service worker registration failed', error);
      });
  });
})();
`;
}

function buildCampaignClientScript() {
  return `
(function () {
  function renderTestView(testId, text) {
    const node = document.createElement('div');
    node.setAttribute('data-testid', testId);
    node.textContent = text;
    document.body.replaceChildren(node);
  }

  window.addEventListener('load', () => {
    const pathname = window.location.pathname;
    if (pathname === ${JSON.stringify(CAMPAIGN_PATH)}) {
      renderTestView(
        'campaign-page',
        'Campaign: ' + window.location.search,
      );
      return;
    }
    renderTestView('campaign-home', 'Campaign build home');
  });
})();
`;
}

function createReleaseArtifacts(build, scriptContent) {
  const { version, appVersion, buildNumber, commit, buildTime, scriptName } =
    build;
  const integrity = computeSha384Integrity(scriptContent);
  const html = `<!doctype html><html><head><meta charset="utf-8"><script src="/${scriptName}" integrity="${integrity}" crossorigin="anonymous"></script></head><body></body></html>`;
  const manifest = {
    schema: 1,
    version,
    appVersion,
    bundleVersion: buildNumber,
    buildNumber,
    commit,
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
  return { name: build.name, html, manifest, scriptContent, scriptName };
}

function publishReleaseToDir(webRootDir, release) {
  const { name, html, manifest, scriptContent, scriptName } = release;
  fs.writeFileSync(path.join(webRootDir, scriptName), scriptContent, 'utf8');
  fs.writeFileSync(path.join(webRootDir, 'index.html'), html, 'utf8');
  fs.writeFileSync(
    path.join(webRootDir, 'sw-version-manifest.json'),
    JSON.stringify(manifest),
    'utf8',
  );
  logDiagnostics('release.published', {
    name,
    appVersion: manifest.appVersion,
    version: manifest.version,
    script: scriptName,
  });
}

async function waitForControlledRelease(page, version) {
  const deadline = performance.now() + E2E_TIMEOUT_MS;
  while (performance.now() < deadline) {
    // Playwright's waitForFunction treats the pending Promise as truthy.
    const isReady = await page.evaluate(
      async ({ cacheName, statePath, expectedVersion }) => {
        const controller = navigator.serviceWorker.controller;
        // CacheStorage can contain the new release while the old worker is still in control.
        if (
          controller?.state !== 'activated' ||
          new URL(controller.scriptURL).searchParams.get('appBuild') !==
            expectedVersion
        ) {
          return false;
        }
        const response = await caches.match(statePath, { cacheName });
        return (await response?.json())?.activeVersion === expectedVersion;
      },
      {
        cacheName: VERSION_STATE_CACHE,
        statePath: VERSION_STATE_PATH,
        expectedVersion: version,
      },
    );
    if (isReady) return;
    await delay(100);
  }
  throw new Error(
    `Timed out waiting for release ${version} to control the page`,
  );
}

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-sw-e2e-'));
  const webRootDir = path.join(tmpDir, 'www');
  fs.mkdirSync(webRootDir, { recursive: true });
  let staticServer;
  let context;
  let page;
  let step = 'compile service worker and clients';
  const topLevelNavigations = [];

  try {
    await compileTestBundles(tmpDir);
    fs.copyFileSync(
      path.join(tmpDir, 'service-worker.js'),
      path.join(webRootDir, 'service-worker.js'),
    );

    const legacyRelease = createReleaseArtifacts(
      LEGACY_BUILD,
      buildLegacyClientScript(),
    );
    const recoveryRelease = createReleaseArtifacts(
      RECOVERY_BUILD,
      fs.readFileSync(path.join(tmpDir, RECOVERY_BUILD.scriptName), 'utf8'),
    );
    const campaignRelease = createReleaseArtifacts(
      CAMPAIGN_BUILD,
      buildCampaignClientScript(),
    );

    step = 'serve the legacy release and launch Chromium';
    publishReleaseToDir(webRootDir, legacyRelease);
    staticServer = await startStaticServer({
      rootDir: webRootDir,
      host: '127.0.0.1',
      port: 0,
      spaFallback: true,
    });
    const { baseUrl, server } = staticServer;

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
    context.setDefaultTimeout(E2E_TIMEOUT_MS);

    page = await context.newPage();
    await attachDiagnostics({ context, executablePath, page, server });

    step = 'wait for the legacy client and its cached release';
    await page.goto(`${baseUrl}/`);
    await page.getByTestId('legacy-home').waitFor({ state: 'visible' });
    await waitForControlledRelease(page, LEGACY_BUILD.version);

    page.on('request', (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        topLevelNavigations.push(request.url());
      }
    });

    const unitasUrl = `${baseUrl}${UNITAS_PATH_AND_QUERY}`;
    step = 'open the Unitas link with the legacy client and render its error';
    await page.goto(unitasUrl);
    await page.getByTestId('error-boundary').waitFor({ state: 'visible' });
    await page
      .locator('html[data-version-protocol-ready]')
      .waitFor({ state: 'attached' });
    assert.equal(page.url(), unitasUrl);
    assert.deepEqual(topLevelNavigations, [unitasUrl]);

    step = 'publish the recovery release and wait for the Unitas auto-reload';
    publishReleaseToDir(webRootDir, recoveryRelease);
    const unitasDetail = page.getByTestId('unitas-xaut-detail');
    await unitasDetail.waitFor({ state: 'visible' });
    assert.equal(page.url(), unitasUrl);
    assert.deepEqual(topLevelNavigations, [unitasUrl, unitasUrl]);
    assert.equal(
      await unitasDetail.textContent(),
      `Unitas XAUt Vault: ${new URL(unitasUrl).search}`,
    );
    assert.equal(await page.locator('#sw-update-banner').count(), 0);
    logDiagnostics('phase.passed', { name: 'legacy Unitas recovery' });

    step = 'wait for the activated recovery worker to control the Unitas page';
    await waitForControlledRelease(page, RECOVERY_BUILD.version);

    const campaignUrl = `${baseUrl}${CAMPAIGN_PATH_AND_QUERY}`;
    step = 'open the campaign link on the recovery release and render NotFound';
    topLevelNavigations.length = 0;
    await page.goto(campaignUrl);
    await page.getByTestId('not-found').waitFor({ state: 'visible' });
    // The client sets this marker after the controlling worker responds to the protocol.
    await page
      .locator('html[data-version-protocol-ready]')
      .waitFor({ state: 'attached' });
    assert.equal(page.url(), campaignUrl);
    assert.deepEqual(topLevelNavigations, [campaignUrl]);

    step = 'publish the campaign release and wait for the NotFound auto-reload';
    publishReleaseToDir(webRootDir, campaignRelease);
    const campaignPage = page.getByTestId('campaign-page');
    await campaignPage.waitFor({ state: 'visible' });
    assert.equal(page.url(), campaignUrl);
    assert.deepEqual(topLevelNavigations, [campaignUrl, campaignUrl]);
    assert.equal(
      await campaignPage.textContent(),
      `Campaign: ${new URL(campaignUrl).search}`,
    );
    assert.equal(await page.locator('#sw-update-banner').count(), 0);
    logDiagnostics('phase.passed', { name: 'NotFound campaign recovery' });
  } catch (error) {
    logDiagnostics('test.failed', { step, topLevelNavigations });
    await logPageSnapshot(page, {
      cacheName: VERSION_STATE_CACHE,
      statePath: VERSION_STATE_PATH,
    });
    throw error;
  } finally {
    await context?.close();
    await staticServer?.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
