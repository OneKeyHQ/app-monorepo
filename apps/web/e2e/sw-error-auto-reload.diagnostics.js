const { setTimeout: delay } = require('node:timers/promises');

const startedAt = Date.now();

function logDiagnostics(event, details) {
  console.log(
    `[sw-e2e] ${JSON.stringify({
      elapsedMs: Date.now() - startedAt,
      event,
      ...details,
    })}`,
  );
}

async function attachDiagnostics({ context, executablePath, page, server }) {
  server.on('request', (request, response) => {
    // Version checks poll frequently. Keep manifest errors and log version changes
    // through the release and protocol events below.
    response.once('finish', () => {
      if (
        request.url === '/sw-version-manifest.json' &&
        response.statusCode === 200
      ) {
        return;
      }
      logDiagnostics('http.response', {
        url: request.url,
        status: response.statusCode,
      });
    });
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      logDiagnostics('page.navigated', { url: frame.url() });
    }
  });
  page.on('requestfailed', (request) => {
    logDiagnostics('page.requestFailed', {
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });
  page.on('pageerror', (error) => {
    logDiagnostics('page.error', { error: error.stack || error.message });
  });
  page.on('console', (message) => {
    const level = message.type();
    const text = message.text();
    if (
      level === 'error' ||
      level === 'warning' ||
      text.startsWith('[sw-fixture]')
    ) {
      logDiagnostics('page.console', { level, text });
    }
  });

  await page.addInitScript(() => {
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker) return;
    const log = (event, details) =>
      console.info('[sw-fixture]', JSON.stringify({ event, ...details }));
    const logController = (event) => {
      const { controller } = serviceWorker;
      log(event, {
        url: location.href,
        scriptURL: controller?.scriptURL,
        state: controller?.state,
      });
    };
    logController('controller.initial');
    serviceWorker.addEventListener('controllerchange', () => {
      logController('controller.changed');
    });

    let lastVersionState;
    serviceWorker.addEventListener('message', ({ data, source }) => {
      const { type, payload } = data ?? {};
      const {
        version,
        activeVersion,
        readyVersion,
        failedVersion,
        lastError,
        errorCode,
        operation,
        retryAt,
        autoReload,
      } = payload ?? {};
      const details = {
        url: location.href,
        worker: source?.scriptURL,
        version,
        activeVersion,
        readyVersion,
        failedVersion,
        lastError,
        errorCode,
        operation,
        retryAt,
        autoReload,
      };
      if (type === 'VERSION_STATE') {
        const state = JSON.stringify(details);
        if (state === lastVersionState) return;
        lastVersionState = state;
      }
      if (
        [
          'VERSION_STATE',
          'UPDATE_READY',
          'UPDATE_FAILED',
          'VERSION_ACTIVATED',
        ].includes(type)
      ) {
        log(type, details);
      }
    });
  });

  try {
    const cdp = await context.newCDPSession(page);
    const { product } = await cdp.send('Browser.getVersion');
    logDiagnostics('browser.started', {
      product,
      executablePath,
      node: process.version,
    });
    cdp.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
      logDiagnostics('worker.versionsUpdated', { versions });
    });
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      logDiagnostics('worker.registrationsUpdated', { registrations });
    });
    cdp.on('ServiceWorker.workerErrorReported', ({ error }) => {
      logDiagnostics('worker.error', { error });
    });
    await cdp.send('ServiceWorker.enable');
  } catch (error) {
    logDiagnostics('browser.lifecycleDiagnosticsUnavailable', {
      error: error.message,
    });
  }
}

async function logPageSnapshot(page, cache) {
  if (!page || page.isClosed()) return;

  try {
    const snapshot = await Promise.race([
      page.evaluate(async ({ cacheName, statePath }) => {
        const describeWorker = (worker) =>
          worker ? { scriptURL: worker.scriptURL, state: worker.state } : null;
        const serviceWorker = navigator.serviceWorker;
        const probeErrors = {};
        async function readProbe(name, read) {
          try {
            return await read();
          } catch (error) {
            probeErrors[name] = error?.message ?? String(error);
            return null;
          }
        }
        const [registration, state, cacheNames] = await Promise.all([
          readProbe('registration', () => serviceWorker?.getRegistration()),
          readProbe('versionState', async () => {
            const response = await globalThis.caches?.match(statePath, {
              cacheName,
            });
            return response?.json();
          }),
          readProbe('cacheNames', () => globalThis.caches?.keys()),
        ]);
        return {
          url: location.href,
          readyState: document.readyState,
          view: document
            .querySelector('[data-testid]')
            ?.getAttribute('data-testid'),
          protocolReady: document.documentElement?.dataset.versionProtocolReady,
          routeNotFound: globalThis.__onekeyWebRouteNotFound,
          controller: describeWorker(serviceWorker?.controller),
          registration: registration
            ? {
                scope: registration.scope,
                active: describeWorker(registration.active),
                waiting: describeWorker(registration.waiting),
                installing: describeWorker(registration.installing),
              }
            : null,
          versionState: state
            ? {
                activeVersion: state.activeVersion,
                readyVersion: state.readyVersion,
                failedVersion: state.failedVersion,
                lastError: state.lastError,
                retryAt: state.retryAt,
              }
            : null,
          cacheNames,
          probeErrors,
        };
      }, cache),
      delay(
        2000,
        { error: 'Timed out reading the browser state' },
        { ref: false },
      ),
    ]);
    logDiagnostics('test.snapshot', snapshot);
  } catch (error) {
    logDiagnostics('test.snapshotUnavailable', { error: error.message });
  }
}

module.exports = {
  attachDiagnostics,
  logDiagnostics,
  logPageSnapshot,
};
