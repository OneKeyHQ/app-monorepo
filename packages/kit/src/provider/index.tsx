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
import type { ComponentType } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Toast } from '@onekeyhq/components';
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

const LastActivityTracker = LazyLoad(
  () => import('../components/LastActivityTracker'),
  3000,
);

// Non-first-screen siblings — delayed to shorten the KitProvider sync-mount
// critical path. The UX-visible behavior of each is deferred:
//   - PasswordVerify: only renders on user-triggered protected actions
//   - StateActive: badge clear + AppState handler — a 300ms delay is not
//       visible to the user on cold start
//   - Hardware: SDK init happens only when a hardware wallet is active
//   - WebViewWebEmbed: webembed webview is shown on demand via event bus
//   - SyncHomeAccountToDapp: dapp account mirror, irrelevant until user
//       opens a dapp tab
const PasswordVerifyPromptMount = LazyLoad(
  () => import('../components/Password/container/PasswordVerifyPromptMount'),
  500,
);
const StateActiveContainer = LazyLoad(
  () =>
    import('./Container/StateActiveContainer').then((m) => ({
      default: m.StateActiveContainer,
    })) as unknown as Promise<{
      default: ComponentType<Record<string, unknown>>;
    }>,
  300,
);
const HardwareServiceProvider = LazyLoad(
  () =>
    import('./HardwareServiceProvider').then((m) => ({
      default: m.HardwareServiceProvider,
    })) as unknown as Promise<{
      default: ComponentType<Record<string, unknown>>;
    }>,
  500,
);
const WebViewWebEmbedProvider = LazyLoad(
  () =>
    import('./WebViewWebEmbedProvider').then((m) => ({
      default: m.WebViewWebEmbedProvider,
    })) as unknown as Promise<{
      default: ComponentType<Record<string, unknown>>;
    }>,
  1500,
);
const SyncHomeAccountToDappAccountProvider = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/Discovery/components/SyncDappAccountToHomeProvider').then(
      (m) => ({
        default: m.SyncHomeAccountToDappAccountProvider,
      }),
    ) as unknown as Promise<{
      default: ComponentType<Record<string, unknown>>;
    }>,
  1500,
);

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
                <PasswordVerifyPromptMount />
                <WebViewWebEmbedProvider />
                <LastActivityTracker />
                <SystemLocaleTracker />
                <StateActiveContainer />
                <SyncHomeAccountToDappAccountProvider />
                <HardwareServiceProvider />
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
