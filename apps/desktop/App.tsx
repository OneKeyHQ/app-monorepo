/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';

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

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return <SentryKitProvider {...props} />;
}
// export default KitProvider;
