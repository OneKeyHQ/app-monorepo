// oxlint-disable unicorn/prefer-global-this
/* eslint-disable import/first */
import '@onekeyhq/shared/src/performance/init';

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

import '@onekeyhq/shared/src/polyfills';
import { registerRootComponent } from 'expo';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { initIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import App from './App';

initSentry();

void initIntercom();

registerRootComponent(withSentryHOC(App, SentryErrorBoundaryFallback));

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
              // New version available, prompt user to reload
              if (
                window.confirm('A new version is available. Reload to update?')
              ) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            }
          });
        });
      });

    // Reload once the new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}
