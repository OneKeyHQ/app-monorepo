// oxlint-disable import-js/order
/* eslint-disable @typescript-eslint/no-unused-vars, import/first */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';
import { useEffect, useState } from 'react';
import { KitProvider } from '@onekeyhq/kit';
import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { TrayPanel } from '@onekeyhq/kit/src/views/Tray/TrayPanel';
import { TamaguiProvider } from '@onekeyhq/components/src/hocs/Provider/TamaguiProvider';
import tamaguiConfig from '@onekeyhq/components/tamagui.config';

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

// Remove HTML splash before React mounts (safe: runs once at module load)
if (
  typeof globalThis !== 'undefined' &&
  typeof globalThis.location !== 'undefined' &&
  new URLSearchParams(globalThis.location.search).get('render') === 'tray'
) {
  const splash = document.querySelector('.onekey-index-html-preload-image');
  if (splash) splash.remove();
}

function TrayPanelApp() {
  const [theme, setTheme] = useState(() =>
    globalThis.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );

  useEffect(() => {
    const mq = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <TrayPanel />
    </TamaguiProvider>
  );
}

export default function App(props: any) {
  const isTrayPanel =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.location !== 'undefined' &&
    new URLSearchParams(globalThis.location.search).get('render') === 'tray';

  if (isTrayPanel) {
    return <TrayPanelApp />;
  }

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return <SentryKitProvider {...props} />;
}
// export default KitProvider;
