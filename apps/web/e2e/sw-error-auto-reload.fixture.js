import { syncWebRouteNotFoundState } from '@onekeyhq/kit/src/routes/config/webDappUrlFallback';

import {
  createServiceWorkerVersionProtocol,
  nudgeWaitingServiceWorker,
} from '../src/serviceWorkerVersionProtocol';

const version = process.env.WEB_E2E_CLIENT_VERSION;
const protocol = createServiceWorkerVersionProtocol({
  // Exercise periodic checks so a check for the previous release can settle first.
  checkIntervalMs: 250,
  getCurrentWebVersion: () => version,
  isPageInErrorState: () => Boolean(globalThis.__onekeyWebRouteNotFound),
  showUpdateBanner(onRefresh) {
    document.getElementById('sw-update-banner')?.remove();
    const button = document.createElement('button');
    button.id = 'sw-update-banner';
    button.textContent = 'Refresh';
    button.onclick = onRefresh;
    document.body.appendChild(button);
  },
});

function renderTestView(testId, text) {
  const node = document.createElement('div');
  node.setAttribute('data-testid', testId);
  node.textContent = text;
  document.body.replaceChildren(node);
}

function renderApp() {
  const { pathname, search } = globalThis.location;
  if (pathname === '/earn/bsc/XAUt/unitas') {
    renderTestView('unitas-xaut-detail', `Unitas XAUt Vault: ${search}`);
    return;
  }
  if (pathname === '/' || pathname === '/swap') {
    renderTestView('recovery-home', 'Route recovery build home');
    return;
  }
  renderTestView('not-found', 'NotFound');
  syncWebRouteNotFoundState({
    path: `${pathname}${search}`,
    state: { routes: [{ name: 'NotFound' }] },
  });
}

globalThis.addEventListener('load', () => {
  renderApp();
  const scriptURL = `/service-worker.js?tradingviewEmbedProtocol=1&appBuild=${encodeURIComponent(version)}`;
  console.info('[sw-fixture] Registering recovery service worker', scriptURL);
  void navigator.serviceWorker
    .register(scriptURL, { scope: '/', updateViaCache: 'none' })
    .then((registration) => {
      nudgeWaitingServiceWorker(registration);
      const markProtocolReady = ({ data }) => {
        if (
          data?.type === 'VERSION_STATE' &&
          data.payload?.activeVersion === version
        ) {
          navigator.serviceWorker.removeEventListener(
            'message',
            markProtocolReady,
          );
          document.documentElement.dataset.versionProtocolReady = 'true';
        }
      };
      navigator.serviceWorker.addEventListener('message', markProtocolReady);
      // Do not wake the outgoing worker with a version check while Chrome is
      // stopping it to activate this release's worker.
      function startProtocolWhenControlled() {
        const controller = navigator.serviceWorker.controller;
        if (controller?.scriptURL !== new URL(scriptURL, location.href).href) {
          return;
        }
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          startProtocolWhenControlled,
        );
        protocol.setup();
      }
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        startProtocolWhenControlled,
      );
      startProtocolWhenControlled();
    })
    .catch((error) => {
      console.error(
        '[sw-fixture] Recovery service worker registration failed',
        error,
      );
    });
});
