// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */
import '@onekeyhq/shared/src/performance/init';

if (typeof globalThis !== 'undefined') {
  globalThis.$$onekeyJsReadyAt = Date.now();
}

import '@onekeyhq/shared/src/polyfills';
import { registerRootComponent } from 'expo';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { initIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import App from './App';

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('imports done');
}

initSentry();

void initIntercom();

if (process.env.NODE_ENV !== 'production') {
  const { debugLandingLog } = require('@onekeyhq/shared/src/performance/init');
  debugLandingLog('sentry+intercom init done');
}

registerRootComponent(withSentryHOC(App, SentryErrorBoundaryFallback));

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
      .register('/service-worker.js')
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
