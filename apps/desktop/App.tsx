/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';

import { lazy, Suspense } from 'react';

import { KitProvider } from '@onekeyhq/kit';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
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

const AgentationDev =
  process.env.NODE_ENV !== 'production'
    ? lazy(() =>
        import('agentation').then((m) => ({ default: m.Agentation })),
      )
    : () => null;

function DesktopApp(props: any) {
  return (
    <>
      <KitProvider {...props} />
      {process.env.NODE_ENV !== 'production' && (
        <Suspense>
          <AgentationDev endpoint="http://localhost:4747" />
        </Suspense>
      )}
    </>
  );
}

export default withSentryHOC(DesktopApp, SentryErrorBoundaryFallback);
