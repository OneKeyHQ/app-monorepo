// cspell:ignore LavaMoat lavamoat testid

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');

const { chromium } = require('playwright-core');

const { LavaMoatError } = require('./error.cjs');

// Use the existing jsdom dependency's parser without creating a DOM or running
// scripts. HTML comments, template content, and script text are not elements.
const { parse } = createRequire(require.resolve('jsdom'))('parse5');

const { values } = parseArgs({
  options: {
    chrome: { type: 'string' },
    output: { type: 'string' },
    'live-health-check': { type: 'boolean', default: false },
  },
});
const root = fs.realpathSync(
  path.resolve(__dirname, '../../apps/web/web-build'),
);
const output = values.output
  ? path.resolve(values.output)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-web-smoke-'));
fs.mkdirSync(output, { recursive: true });

function validateProtectedArtifact() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const files = fs.readdirSync(root).filter((file) => file.endsWith('.js'));
  const runtimes = files.filter((file) =>
    /^lavamoat-runtime\.[a-f0-9]+\.bundle\.js$/.test(file),
  );
  assert.equal(runtimes.length, 1, 'Expected one protected LavaMoat runtime');
  const [runtime] = runtimes;
  const sesRequire = createRequire(require.resolve('@lavamoat/webpack'));
  const ses = fs.readFileSync(sesRequire.resolve('ses'), 'utf8');
  let wrappedAssets = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(
      source.split(ses).length - 1,
      file === runtime ? 1 : 0,
      `${file} must contain untouched SES exactly when it owns the runtime`,
    );
    if (file === runtime) {
      assert.match(source, /\._LM_\s*=/, 'Runtime must install LavaMoat');
    } else if (/\._LM_\(/.test(source)) {
      wrappedAssets += 1;
    }
  }
  assert.ok(wrappedAssets > 0, 'Application modules must use LavaMoat');
  const sources = [];
  const visit = (node) => {
    if (
      node.tagName === 'script' &&
      node.namespaceURI === 'http://www.w3.org/1999/xhtml'
    ) {
      const attributes = Object.fromEntries(
        node.attrs.map(({ name, value }) => [name, value]),
      );
      if (attributes.src) sources.push(attributes);
    }
    // Template contents live in a separate fragment and remain inert.
    node.childNodes?.forEach(visit);
  };
  visit(parse(html, { scriptingEnabled: true }));
  const scripts = sources.map(({ src }) => {
    const url = new URL(src, 'http://localhost/');
    assert.equal(url.origin, 'http://localhost', 'Scripts must be local');
    const file = decodeURIComponent(url.pathname).slice(1);
    const resolved = fs.realpathSync(path.join(root, file));
    assert.ok(resolved.startsWith(`${root}${path.sep}`));
    assert.ok(fs.statSync(resolved).isFile(), `Missing HTML script: ${file}`);
    return file;
  });
  assert.equal(
    scripts[0],
    runtime,
    'HTML must load the protected runtime first',
  );
  assert.equal(scripts.filter((file) => file === runtime).length, 1);
  for (const [index, file] of scripts.entries()) {
    assert.equal(
      sources[index].integrity,
      `sha384-${crypto
        .createHash('sha384')
        .update(fs.readFileSync(path.join(root, file)))
        .digest('base64')}`,
      `HTML integrity must match the final bytes of ${file}`,
    );
    assert.equal(
      sources[index].crossorigin,
      'anonymous',
      `HTML must retain anonymous cross-origin loading for ${file}`,
    );
  }
  return {
    indexSha256: crypto.createHash('sha256').update(html).digest('hex'),
    runtime,
    wrappedAssets,
  };
}

// Match actual page content, not the shared header or a loading/error shell.
function getReadyScreen(route) {
  const visible = (element) =>
    element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const byId = (id, parent = document) =>
    parent.querySelector(`[data-testid="${id}"]`);
  const hasText = (element, text) =>
    visible(element) && element.innerText.includes(text);
  const onboarding = byId('onboarding-get-started-page');
  if (
    visible(onboarding) &&
    hasText(
      byId('onboarding-create-wallet-button', onboarding),
      'Create new wallet',
    ) &&
    hasText(
      byId('onboarding-import-wallet-button', onboarding),
      'Add existing wallet',
    )
  )
    return 'onboarding';
  const home = byId('home-page');
  if (
    visible(home) &&
    visible(byId('web-dapp-btn', home)) &&
    hasText(home, 'Connect wallet') &&
    hasText(home, 'Track any address')
  )
    return 'wallet-connect';
  const emptyWallet = byId('Wallet-No-Wallet-Empty', home || document);
  if (
    visible(home) &&
    hasText(emptyWallet, 'No wallet') &&
    hasText(emptyWallet, 'Create wallet')
  ) {
    return 'wallet-empty';
  }
  const market = byId('market-page');
  const marketContent = [
    'market-trending-desktop-toolbar',
    'market-top-coins-list',
    'market-stock-list',
    'market-perps-list',
    'market-watch-list',
    'market-sort-change',
  ];
  if (
    route === '/' &&
    visible(market) &&
    hasText(byId('market-tabs', market), 'Favorites') &&
    marketContent.some((id) => visible(byId(id, market)))
  )
    return 'market';
  return null;
}

// Register before SES: its unhandled-rejection console report can wait for GC.
// The native CDP binding only sends diagnostics and is hidden from app code.
function observeUnhandledRejections(bindingName) {
  const report = globalThis[bindingName];
  delete globalThis[bindingName];
  const stringify = JSON.stringify;
  const toString = String;
  globalThis.addEventListener('unhandledrejection', (event) => {
    const diagnostic = { message: 'Unhandled promise rejection' };
    try {
      diagnostic.message = toString(event.reason);
    } catch {
      diagnostic.message = 'Unhandled promise rejection (unreadable reason)';
    }
    try {
      if (typeof event.reason?.stack === 'string') {
        diagnostic.stack = event.reason.stack;
      }
    } catch {
      diagnostic.stackCaptureError = 'Rejection stack is unavailable';
    }
    // Do not preventDefault or interfere with application/SES error handlers.
    report(stringify(diagnostic));
  });
}

function isExternalNetworkConsoleError(error, externalFailures) {
  const resourceFailure =
    /^Failed to load resource: (?:net::ERR_[A-Z_]+|the server responded with a status of [45]\d\d\b)/.test(
      error.text,
    );
  const corsFailure =
    /^Access to (?:fetch|XMLHttpRequest|font|image|script) at '([^']+)' from origin '[^']+' has been blocked by CORS policy:/.exec(
      error.text,
    );
  return Boolean(
    (resourceFailure && externalFailures.has(error.url)) ||
    (corsFailure && externalFailures.has(corsFailure[1])),
  );
}

async function captureConsoleErrorStack(cdp, objectId, diagnostic) {
  let timeout;
  try {
    const response = await Promise.race([
      cdp.send('Runtime.callFunctionOn', {
        objectId,
        functionDeclaration: 'function () { return this.stack; }',
        returnByValue: true,
        silent: true,
      }),
      new Promise((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new LavaMoatError('Console stack capture timed out')),
          2000,
        );
      }),
    ]);
    if (response.exceptionDetails) {
      diagnostic.stackCaptureError = response.exceptionDetails.text;
    } else if (typeof response.result.value === 'string') {
      diagnostic.stack = response.result.value;
    }
  } catch (error) {
    diagnostic.stackCaptureError = String(error);
  } finally {
    clearTimeout(timeout);
  }
}

const mime = {
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    );
    let filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(`${root}${path.sep}`) && filename !== root) {
      response.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      if (path.extname(pathname)) {
        response.writeHead(404).end();
        return;
      }
      filename = path.join(root, 'index.html');
    }
    if (!fs.realpathSync(filename).startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    response.writeHead(200, {
      'content-type':
        mime[path.extname(filename)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(400).end();
  }
});

async function main() {
  const report = {
    ...validateProtectedArtifact(),
    routes: [],
  };
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: values.chrome,
    headless: true,
  });
  try {
    for (const route of ['/', '/wallet/']) {
      // Each route starts with an empty browser profile and no wallet data.
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: 'en-US',
      });
      const page = await context.newPage();
      const result = {
        route,
        healthCheck: {
          responseSource: values['live-health-check'] ? 'live' : 'fixture',
          requests: 0,
          responses: [],
        },
        exceptions: [],
        unhandledRejections: [],
        consoleErrors: [],
        consoleApiErrors: [],
        failedAssets: [],
      };
      const externalFailures = new Set();
      const pendingAssets = new Set();
      const startupFailure = Promise.withResolvers();
      const stackCaptures = [];
      let collectConsoleStacks = true;
      let lastAssetActivity = Date.now();
      report.routes.push(result);
      const isHealthRequest = (url) =>
        new URL(url).pathname === '/wallet/v1/health';
      if (!values['live-health-check']) {
        // The app must still call its compartment's fetch and reach Chromium's
        // network boundary. A controlled response keeps CI independent of the
        // service's availability; it cannot hide a pre-network receiver error.
        await page.route(
          (url) => isHealthRequest(url.href),
          (requestRoute) =>
            requestRoute.fulfill({
              status: 200,
              contentType: 'application/json',
              body: '{"code":0,"data":"ok"}',
            }),
        );
      }
      const cdp = await context.newCDPSession(page);
      await cdp.send('Runtime.enable');
      const rejectionBinding = '__onekeyLavaMoatSmokeRejection__';
      cdp.on('Runtime.bindingCalled', ({ name, payload }) => {
        if (name === rejectionBinding) {
          const diagnostic = JSON.parse(payload);
          result.unhandledRejections.push(diagnostic);
          startupFailure.reject(new LavaMoatError(diagnostic.message));
        }
      });
      await cdp.send('Runtime.addBinding', { name: rejectionBinding });
      await page.addInitScript(observeUnhandledRejections, rejectionBinding);
      cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
        result.exceptions.push({
          message:
            exceptionDetails.exception?.description || exceptionDetails.text,
          stack: exceptionDetails.stackTrace,
        });
        startupFailure.reject(
          new LavaMoatError(result.exceptions.at(-1).message),
        );
      });
      cdp.on('Runtime.consoleAPICalled', ({ type, args, stackTrace }) => {
        if (type === 'error') {
          result.consoleApiErrors.push({
            arguments: args.map((argument) => {
              const diagnostic = {
                type: argument.type,
                description:
                  argument.description ??
                  argument.unserializableValue ??
                  String(argument.value),
              };
              // SES can omit the original Error stack from CDP's description.
              // Read it in this empty profile and await every bounded capture.
              if (argument.objectId && collectConsoleStacks) {
                stackCaptures.push(
                  captureConsoleErrorStack(cdp, argument.objectId, diagnostic),
                );
              }
              return diagnostic;
            }),
            stack: stackTrace,
          });
        }
      });
      page.on('console', (message) => {
        if (message.type() === 'error') {
          result.consoleErrors.push({
            text: message.text(),
            url: message.location().url,
          });
        }
      });
      page.on('request', (request) => {
        if (isHealthRequest(request.url())) result.healthCheck.requests += 1;
        if (
          request.url().startsWith(`${origin}/`) &&
          !isHealthRequest(request.url())
        ) {
          pendingAssets.add(request);
          lastAssetActivity = Date.now();
        }
      });
      page.on('requestfinished', (request) => {
        if (pendingAssets.delete(request)) lastAssetActivity = Date.now();
      });
      page.on('requestfailed', (request) => {
        if (pendingAssets.delete(request)) lastAssetActivity = Date.now();
        if (request.url().startsWith(`${origin}/`)) {
          result.failedAssets.push({
            url: request.url(),
            failure: request.failure(),
          });
        } else if (/^https?:\/\//.test(request.url())) {
          externalFailures.add(request.url());
        }
      });
      page.on('response', (response) => {
        if (isHealthRequest(response.url())) {
          result.healthCheck.responses.push({
            origin: new URL(response.url()).origin,
            status: response.status(),
          });
        }
        if (
          response.url().startsWith(`${origin}/`) &&
          response.status() >= 400
        ) {
          result.failedAssets.push({
            url: response.url(),
            status: response.status(),
          });
        } else if (
          response.status() >= 400 &&
          /^https?:\/\//.test(response.url())
        ) {
          externalFailures.add(response.url());
        }
      });
      try {
        await Promise.race([
          (async () => {
            await page.goto(`${origin}${route}`, {
              waitUntil: 'domcontentloaded',
            });
            await page.waitForFunction(getReadyScreen, route, {
              timeout: 45_000,
            });
          })(),
          startupFailure.promise,
        ]);
        const settleDeadline = Date.now() + 10_000;
        while (pendingAssets.size || Date.now() - lastAssetActivity < 500) {
          assert.ok(
            Date.now() < settleDeadline,
            'Initial local assets must settle',
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const healthDeadline = Date.now() + 15_000;
        while (
          !result.healthCheck.responses.some(({ status }) => status === 200)
        ) {
          assert.ok(
            Date.now() < healthDeadline,
            'Application health request must reach the browser and return 200',
          );
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (values['live-health-check']) {
          assert.ok(
            result.healthCheck.responses.some(
              (response) =>
                response.status === 200 &&
                response.origin !== origin &&
                response.origin.startsWith('https://'),
            ),
            'Live health check must reach an external HTTPS service, not the local SPA fallback',
          );
        }
        // Production minification removes caught console errors. Observe the
        // resulting application state as well as the successful request.
        await page.waitForFunction(
          () =>
            !/(?:^|\n)\s*Offline\s*(?:\n|$)|You are offline\./.test(
              document.body.innerText,
            ),
          undefined,
          { timeout: 5000 },
        );
        result.healthCheck.offlineIndicatorVisible = false;
        result.readyScreen = await page.evaluate(getReadyScreen, route);
        assert.ok(
          result.readyScreen,
          'Application page must remain visible after assets settle',
        );
        result.state = await page.evaluate(async () => ({
          url: location.href,
          title: document.title,
          text: document.body.innerText.slice(0, 2000),
          controls: [
            ...document.querySelectorAll('button, [role="button"], a[href]'),
          ].filter((element) => element.getClientRects().length > 0).length,
          harden: typeof globalThis.harden,
          frozen: [Object.prototype, Array.prototype, Function.prototype].map(
            Object.isFrozen,
          ),
          canMutate: Reflect.set(
            Object.prototype,
            '__lavamoatSmokeMutation__',
            true,
          ),
          promiseAndTimer: await new Promise((resolve) => {
            setTimeout(() => resolve(true), 10);
          }),
        }));
        assert.equal(
          result.state.title,
          result.readyScreen === 'market' ? 'OneKey - Market' : 'OneKey',
        );
        assert.ok(
          result.state.controls > 0,
          'Application controls must render',
        );
        assert.equal(result.state.harden, 'function');
        assert.deepEqual(result.state.frozen, [true, true, true]);
        assert.equal(result.state.canMutate, false);
        assert.equal(result.state.promiseAndTimer, true);
      } finally {
        // Capture failures without skipping cleanup or hiding an earlier error.
        try {
          await page.screenshot({
            path: path.join(output, route === '/' ? 'root.png' : 'wallet.png'),
          });
        } catch (error) {
          result.screenshotError = String(error);
        }
        // Stop queuing new remote reads before draining them; later errors still
        // retain their descriptions and remain fatal through consoleErrors.
        collectConsoleStacks = false;
        await Promise.allSettled(stackCaptures);
        try {
          await context.close();
        } catch (error) {
          result.cleanupError = String(error);
        }
        result.ignoredExternalNetworkErrors = result.consoleErrors.filter(
          (error) => isExternalNetworkConsoleError(error, externalFailures),
        );
        fs.writeFileSync(
          path.join(output, 'report.json'),
          JSON.stringify(report, null, 2),
        );
      }
      // A settled readiness race cannot reject again. Include errors arriving
      // during the asset checks or screenshot before declaring this route ready.
      assert.deepEqual(result.exceptions, [], 'Uncaught application exception');
      assert.deepEqual(
        result.unhandledRejections,
        [],
        'Unhandled application promise rejection',
      );
      assert.deepEqual(
        result.failedAssets,
        [],
        'Production asset failed to load',
      );
      assert.deepEqual(
        result.consoleErrors.filter(
          (error) => !isExternalNetworkConsoleError(error, externalFailures),
        ),
        [],
        'Application console error (including caught render errors)',
      );
      assert.equal(
        result.screenshotError,
        undefined,
        'Smoke screenshot failed',
      );
      assert.equal(
        result.cleanupError,
        undefined,
        'Smoke context cleanup failed',
      );
    }
    console.log(`LavaMoat Web production smoke passed. Evidence: ${output}`);
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    console.error(`LavaMoat Web smoke evidence: ${output}`);
    process.exitCode = 1;
  })
  .finally(() => server.close());
