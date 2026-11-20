// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */
/* oxlint-disable import-js/order */
import '@onekeyhq/shared/src/polyfills';

import '@onekeyhq/shared/src/performance/init';

if (typeof globalThis !== 'undefined') {
  globalThis.$$onekeyJsReadyAt = Date.now();
}

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
import { TRADING_VIEW_EMBED_SERVICE_WORKER_PATH } from '@onekeyhq/shared/src/utils/tradingViewEmbedServiceWorker';

import App from './App';
import { createServiceWorkerVersionProtocol } from './src/serviceWorkerVersionProtocol';

const DEFERRED_SENTRY_INIT_DELAY_MS = 6000;
const SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS = timerUtils.getTimeDurationMs({
  minute: 30,
});
let hasRootPageError = false;
const CURRENT_WEB_VERSION_INFO = createCurrentWebVersionInfo();
const versionProtocol = createServiceWorkerVersionProtocol({
  checkIntervalMs: SERVICE_WORKER_UPDATE_CHECK_INTERVAL_MS,
  getCurrentWebVersion,
  isPageInErrorState,
  showUpdateBanner,
});

function formatLocaleMessage(id, defaultMessage, values) {
  return appLocale.intl.formatMessage({ id, defaultMessage }, values);
}

class WebRootErrorBoundary extends React.PureComponent {
  state = { error: null };

  componentDidCatch(error) {
    this.setState({ error });
    hasRootPageError = true;
    versionProtocol.requestRecoveryCheck();
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
    if (versionProtocol.isReloadPending()) {
      return;
    }
    document.getElementById('sw-update-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'max-content',
      maxWidth: 'calc(100% - 32px)',
      maxHeight: 'calc(100% - 48px)',
      overflowY: 'auto',
      boxSizing: 'border-box',
      zIndex: '2147483647',
      display: 'flex',
      flexWrap: 'wrap',
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
    text.style.minWidth = '0';
    text.style.overflowWrap = 'anywhere';
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
      flexShrink: '0',
      maxWidth: '100%',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
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
      flexShrink: '0',
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

function createCurrentWebVersionInfo() {
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

function getCurrentWebVersionInfo() {
  return CURRENT_WEB_VERSION_INFO;
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

function isPageInErrorState() {
  return Boolean(hasRootPageError || globalThis.__onekeyWebRouteNotFound);
}

// Register service worker in production only
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(TRADING_VIEW_EMBED_SERVICE_WORKER_PATH, {
        scope: '/',
        updateViaCache: 'none',
      })
      .then((registration) => {
        versionProtocol.setup();
        navigator.serviceWorker.ready
          .then(() => versionProtocol.requestVersionCheck())
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
