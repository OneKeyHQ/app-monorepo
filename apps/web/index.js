// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */
/* oxlint-disable import-js/order */
import '@onekeyhq/shared/src/performance/init';

if (typeof globalThis !== 'undefined') {
  globalThis.$$onekeyJsReadyAt = Date.now();
}

import '@onekeyhq/shared/src/polyfills';

// Cold-start hydration: fires IndexedDB read promise + populates globalThis
// vars before React mounts. Must run after polyfills, before any jotai atoms
// are referenced. See packages/kit/src/components/GlobalJotaiReady which
// awaits the cold-start gate on web/desktop.
import '@onekeyhq/kit-bg/src/hydration/hydrate';

import '@onekeyhq/shared/src/security/sesHarden/installWeb';

import { registerRootComponent } from 'expo';
import React from 'react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import App from './App';

const DEFERRED_SENTRY_INIT_DELAY_MS = 6000;
const SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS = timerUtils.getTimeDurationMs({
  minute: 30,
});
const ROOT_SERVICE_WORKER_PATH = '/service-worker.js';
const SERVICE_WORKER_MESSAGE_TYPES = {
  GET_VERSION_STATE: 'GET_VERSION_STATE',
  CHECK_VERSION: 'CHECK_VERSION',
  ACTIVATE_VERSION: 'ACTIVATE_VERSION',
  VERSION_STATE: 'VERSION_STATE',
  UPDATE_READY: 'UPDATE_READY',
  VERSION_ACTIVATED: 'VERSION_ACTIVATED',
};

let pendingVersionActivation = '';

function formatLocaleMessage(id, defaultMessage, values) {
  return appLocale.intl.formatMessage({ id, defaultMessage }, values);
}

class WebRootErrorBoundary extends React.PureComponent {
  state = { error: null };

  componentDidCatch(error) {
    this.setState({ error });
    void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
      ({ captureException, initSentry }) => {
        initSentry();
        captureException(error);
      },
    );
  }

  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        {
          style: {
            alignItems: 'center',
            display: 'flex',
            height: '100vh',
            justifyContent: 'center',
            padding: 24,
          },
        },
        formatLocaleMessage(
          ETranslations.global_unknown_error_retry_message,
          'An unexpected error occurred. Please try again.',
        ),
      );
    }

    return this.props.children;
  }
}

function RootApp() {
  return React.createElement(
    WebRootErrorBoundary,
    null,
    React.createElement(App),
  );
}

function initSentryAfterStartup() {
  const start = () => {
    setTimeout(() => {
      void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
        ({ initSentry }) => initSentry(),
      );
    }, DEFERRED_SENTRY_INIT_DELAY_MS);
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
}

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('imports done');
}

if (process.env.NODE_ENV === 'production') {
  void loadLocaleMessages(getDefaultLocale());
  initSentryAfterStartup();
} else {
  void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
    ({ initSentry }) => initSentry(),
  );
}

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('sentry init done');
}

registerRootComponent(RootApp);
logCurrentWebVersionInfo();

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('registerRootComponent called');
}

function showUpdateBanner(onRefresh) {
  const show = () => {
    document.getElementById('sw-update-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      borderRadius: '12px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(8px)',
    });

    const text = document.createElement('span');
    text.textContent = formatLocaleMessage(
      ETranslations.settings_app_update_available,
      'App update available',
    );

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = formatLocaleMessage(
      ETranslations.global_refresh,
      'Refresh',
    );
    Object.assign(refreshBtn.style, {
      padding: '6px 16px',
      borderRadius: '8px',
      border: 'none',
      background: '#44C578',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
    });
    refreshBtn.addEventListener('click', () => {
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '\u00D7';
    Object.assign(dismissBtn.style, {
      padding: '0',
      border: 'none',
      background: 'transparent',
      color: 'rgba(255,255,255,0.6)',
      fontSize: '20px',
      lineHeight: '1',
      cursor: 'pointer',
    });
    dismissBtn.addEventListener('click', () => banner.remove());

    banner.append(text, refreshBtn, dismissBtn);
    document.body.appendChild(banner);
  };

  // Ensure document.body is available before appending
  if (document.body) {
    show();
  } else {
    window.addEventListener('DOMContentLoaded', show);
  }
}

function getCurrentWebVersionInfo() {
  const commit =
    process.env.WORKFLOW_GITHUB_SHA || process.env.GITHUB_SHA || '';
  const buildNumber = process.env.BUILD_NUMBER || '0';
  return {
    appVersion: process.env.VERSION || '',
    bundleVersion: process.env.BUNDLE_VERSION || '',
    buildNumber,
    commitHash: commit || 'local',
    webVersion: `${commit || 'local'}-${buildNumber}`,
  };
}

function getCurrentWebVersion() {
  return getCurrentWebVersionInfo().webVersion;
}

function logCurrentWebVersionInfo() {
  const versionInfo = getCurrentWebVersionInfo();
  console.info(
    `[OneKey Web] appVersion=${versionInfo.appVersion || 'unknown'} commitHash=${versionInfo.commitHash} buildNumber=${versionInfo.buildNumber} bundleVersion=${versionInfo.bundleVersion || 'unknown'} webVersion=${versionInfo.webVersion}`,
  );
}

function postMessageToServiceWorker(type, payload = {}) {
  navigator.serviceWorker.controller?.postMessage({
    type,
    payload: {
      clientVersion: getCurrentWebVersion(),
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
  postMessageToServiceWorker(SERVICE_WORKER_MESSAGE_TYPES.ACTIVATE_VERSION, {
    version,
  });
  setTimeout(() => {
    if (pendingVersionActivation === version) {
      window.location.reload();
    }
  }, 3000);
}

function showReadyVersionBanner(version) {
  if (!version || pendingVersionActivation === version) {
    return;
  }
  showUpdateBanner(() => activateReadyVersion(version));
}

function showActivatedVersionBanner(version) {
  if (!version || version === getCurrentWebVersion()) {
    return false;
  }
  showUpdateBanner(() => window.location.reload());
  return true;
}

function requestServiceWorkerVersionCheck() {
  if (!navigator.serviceWorker.controller) {
    return;
  }
  postMessageToServiceWorker(SERVICE_WORKER_MESSAGE_TYPES.GET_VERSION_STATE);
  postMessageToServiceWorker(SERVICE_WORKER_MESSAGE_TYPES.CHECK_VERSION);
}

function setupServiceWorkerVersionProtocol() {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const type = event.data?.type;
    const payload = event.data?.payload || {};

    if (type === SERVICE_WORKER_MESSAGE_TYPES.UPDATE_READY) {
      showReadyVersionBanner(payload.version);
    }

    if (type === SERVICE_WORKER_MESSAGE_TYPES.VERSION_STATE) {
      if (
        payload.activeVersion &&
        showActivatedVersionBanner(payload.activeVersion)
      ) {
        return;
      }
      if (payload.readyVersion) {
        showReadyVersionBanner(payload.readyVersion);
      }
    }

    if (type === SERVICE_WORKER_MESSAGE_TYPES.VERSION_ACTIVATED) {
      const version = payload.version;
      if (pendingVersionActivation === version) {
        pendingVersionActivation = '';
        window.location.reload();
        return;
      }
      showActivatedVersionBanner(version);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    requestServiceWorkerVersionCheck();
  });

  requestServiceWorkerVersionCheck();
  setInterval(
    requestServiceWorkerVersionCheck,
    SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS,
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestServiceWorkerVersionCheck();
    }
  });
}

// Register service worker in production only
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(ROOT_SERVICE_WORKER_PATH, {
        scope: '/',
        updateViaCache: 'none',
      })
      .then((registration) => {
        setupServiceWorkerVersionProtocol();
        navigator.serviceWorker.ready
          .then(() => requestServiceWorkerVersionCheck())
          .catch(() => {});
        setInterval(() => {
          registration.update().catch(() => {});
        }, SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS);
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
