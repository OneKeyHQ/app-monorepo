// oxlint-disable import-js/order
/* eslint-disable @typescript-eslint/no-unused-vars, import/first */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';
import { KitProvider } from '@onekeyhq/kit';
import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { ConfigProvider } from '@onekeyhq/components';
import { TrayPanel } from '@onekeyhq/kit/src/views/Tray/TrayPanel';

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
  const isTrayPanel =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('render') === 'tray';

  if (isTrayPanel) {
    const isDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = isDark ? 'dark' : 'light';
    return (
      <ConfigProvider theme={theme} locale="en-US" HyperlinkText={null as any}>
        <TrayPanel />
      </ConfigProvider>
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return <SentryKitProvider {...props} />;
}
// export default KitProvider;
