import { syncWebRouteNotFoundState } from '@onekeyhq/kit/src/routes/config/webDappUrlFallback';

import { createServiceWorkerVersionProtocol } from '../src/serviceWorkerVersionProtocol';

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
    renderTestView('v670-home', 'v6.7.0 Home');
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
  void navigator.serviceWorker
    .register(
      `/service-worker.js?tradingviewEmbedProtocol=1&appBuild=${encodeURIComponent(version)}`,
      { scope: '/', updateViaCache: 'none' },
    )
    .then(() => {
      protocol.setup();
      return navigator.serviceWorker.ready;
    })
    .then(() => {
      protocol.requestVersionCheck();
      document.documentElement.dataset.versionProtocolReady = 'true';
    });
});
