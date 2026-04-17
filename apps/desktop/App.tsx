// oxlint-disable import-js/order
/* eslint-disable @typescript-eslint/no-unused-vars, import/first */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';
// Initialize desktopApiProxy singleton and assign to globalThis.desktopApiProxy.
// Must run before any consumer reads globalThis.desktopApiProxy (e.g. Bootstrap, DesktopWebView).
import '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import { Suspense, lazy } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';

import {
  ReanimatedLogLevel,
  configureReanimatedLogger,
} from 'react-native-reanimated';

initSentry();

if (process.env.NODE_ENV !== 'production') {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.error,
    strict: true, // Reanimated runs in strict mode by default
  });
}

const SentryKitProvider = withSentryHOC(
  KitProvider,
  SentryErrorBoundaryFallback,
);

// cspell:ignore Agentation
const AgentationDev =
  process.env.NODE_ENV !== 'production'
    ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
    : () => null;

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return (
    <>
      <SentryKitProvider {...props} />
      {process.env.NODE_ENV !== 'production' ? (
        <Suspense>
          <AgentationDev endpoint="http://localhost:4747" />
        </Suspense>
      ) : null}
    </>
  );
}
// export default KitProvider;
