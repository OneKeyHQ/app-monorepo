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
