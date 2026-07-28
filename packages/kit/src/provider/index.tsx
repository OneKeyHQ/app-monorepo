// Inter fonts are not used — Tamagui uses Roobert. The JS keys (e.g. "Inter_400Regular")
// also don't match the font's internal PostScript names (e.g. "Inter-Regular"), so the
// useFonts registration was ineffective anyway.
// import {
//   Inter_400Regular,
//   Inter_500Medium,
//   Inter_600SemiBold,
// } from '@expo-google-fonts/inter';
// import { useFonts } from 'expo-font';
import { useEffect } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Toast } from '@onekeyhq/components/src/actions/Toast';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';

import { GlobalJotaiReady } from '../components/GlobalJotaiReady';
import SupabaseAuthProvider from '../components/OneKeyAuth/supabase/SupabaseAuthProvider';
import { SystemLocaleTracker } from '../components/SystemLocaleTracker';

import { Container } from './Container';
import { ColdStartByNotification } from './Container/ColdStartByNotification';
import { NetworkReachabilityTracker } from './Container/NetworkReachabilityTracker';
import { KeyboardProvider } from './KeyboardProvider';
import { SplashProvider } from './SplashProvider';
import { ThemeProvider } from './ThemeProvider';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  globalThis._frameTimestamp = null;
}

appGlobals.$Toast = Toast;

const KitProviderLazyContentBeforeLocale = LazyLoad(async () => {
  const { KitProviderLazyContentBeforeLocale: Component } =
    await import('./KitProviderLazyContent');
  return { default: Component };
}, 500);

const KitProviderLazyContentAfterLocale = LazyLoad(async () => {
  const { KitProviderLazyContentAfterLocale: Component } =
    await import('./KitProviderLazyContent');
  return { default: Component };
}, 300);

// Non-first-screen siblings are grouped into one lazy module to keep cold-start
// script count low. KitProviderLazyContent preserves the previous mount delays:
// PasswordVerify 500ms, StateActive 300ms, Hardware 500ms, WebView/SyncDapp
// 1500ms, and LastActivity 3000ms.
const flexStyle = { flex: 1 };

// Relay navigation events from the background thread to the main thread.
// In dual-thread mode, ServiceDApp.openModal emits an event because it has
// no access to the navigation ref. This listener performs the actual navigation.
function BackgroundNavigationRelay() {
  useEffect(() => {
    const handler = (payload: { screen: any; params: any }) => {
      appGlobals.$navigationRef.current?.navigate(
        payload.screen,
        payload.params,
      );
    };
    appEventBus.on(
      EAppEventBusNames.NavigateModalFromBackgroundThread,
      handler,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.NavigateModalFromBackgroundThread,
        handler,
      );
    };
  }, []);
  return null;
}

function logKitProvider(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    defaultLogger.app.appUpdate.log(`[KitProvider] ${message}`);
  }
}

export function KitProvider(props: any = {}) {
  const {
    UIApplicationLaunchOptionsRemoteNotificationKey: launchNotification,
  } = props;

  ColdStartByNotification.launchNotification = launchNotification;

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('KitProvider render');
  }
  logKitProvider('render');

  useDebugComponentRemountLog({ name: 'KitProvider' });

  // useFonts({
  //   Inter_400Regular,
  //   Inter_500Medium,
  //   Inter_600SemiBold,
  // });

  const content = (
    <SafeAreaProvider>
      <GlobalJotaiReady>
        <SupabaseAuthProvider>
          <KeyboardProvider>
            <GestureHandlerRootView style={flexStyle}>
              <ThemeProvider>
                <NetworkReachabilityTracker />
                <SplashProvider>
                  <Container />
                </SplashProvider>
                <KitProviderLazyContentBeforeLocale />
                <SystemLocaleTracker />
                <KitProviderLazyContentAfterLocale />
                <BackgroundNavigationRelay />
              </ThemeProvider>
            </GestureHandlerRootView>
          </KeyboardProvider>
        </SupabaseAuthProvider>
      </GlobalJotaiReady>
    </SafeAreaProvider>
  );

  return content;
}
