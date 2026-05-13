// oxlint-disable import-js/order
/* eslint-disable @typescript-eslint/no-unused-vars, import/first */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';
// Initialize desktopApiProxy singleton and assign to globalThis.desktopApiProxy.
// Must run before any consumer reads globalThis.desktopApiProxy (e.g. Bootstrap, DesktopWebView).
import '@onekeyhq/kit-bg/src/desktopApis/instance/desktopApiProxy';
import { Suspense, lazy, useEffect, useState } from 'react';

import { KitProvider } from '@onekeyhq/kit';
import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

import { installDesktopWatchdog } from './perf/installDesktopWatchdog';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { TrayPanel } from '@onekeyhq/kit/src/views/Tray/TrayPanel';
import { TRAY_IPC } from '@onekeyhq/shared/src/types/desktop/tray';
import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';
import { TamaguiProvider } from '@onekeyhq/components/src/hocs/Provider/TamaguiProvider';
import { AppIntlProvider } from '@onekeyhq/shared/src/locale/AppIntlProvider';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import tamaguiConfig from '@onekeyhq/components/tamagui.config';

import {
  ReanimatedLogLevel,
  configureReanimatedLogger,
} from 'react-native-reanimated';

initSentry();
installDesktopWatchdog();

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

// Runs at module load so splash is gone before React mounts.
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
  // Authoritative locale arrives via TRAY_UPDATE; start with 'en-US' so the
  // loading state can render before the first payload.
  const [locale, setLocale] = useState<ILocaleSymbol>('en-US');

  useEffect(() => {
    const mq = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) =>
      setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleUpdate = (trayData: ITrayData) => {
      if (trayData?.locale) {
        setLocale((prev) =>
          trayData.locale !== prev ? (trayData.locale as ILocaleSymbol) : prev,
        );
      }
    };
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      TRAY_IPC.UPDATE,
      handleUpdate as (...args: unknown[]) => void,
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  return (
    <AppIntlProvider locale={locale}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        <TrayPanel />
      </TamaguiProvider>
    </AppIntlProvider>
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
