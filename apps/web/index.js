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

import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import App from './App';

const DEFERRED_SENTRY_INIT_DELAY_MS = 6000;

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
        this.state.error?.message || 'unknown error by error boundary',
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

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('registerRootComponent called');
}

function showUpdateBanner() {
  const show = () => {
    if (document.getElementById('sw-update-banner')) return;

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
    text.textContent = 'A new version is available';

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
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
    refreshBtn.addEventListener('click', () => window.location.reload());

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

// Register service worker in production only
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw/service-worker.js', { scope: '/' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner();
            }
          });
        });

        // Check for updates every 30 minutes
        setInterval(
          () => {
            registration.update().catch(() => {});
          },
          timerUtils.getTimeDurationMs({ minute: 30 }),
        );
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
