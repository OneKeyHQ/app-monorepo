import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toast } from '@onekeyhq/components';
import { SyncHomeAccountToDappAccountProvider } from '@onekeyhq/kit/src/views/Discovery/components/SyncDappAccountToHomeProvider';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';

import { GlobalJotaiReady } from '../components/GlobalJotaiReady';
import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';
import { SystemLocaleTracker } from '../components/SystemLocaleTracker';

import { ColdStartByNotification, Container } from './Container';
import InAppNotification from './Container/InAppNotification';
import { NetworkReachabilityTracker } from './Container/NetworkReachabilityTracker';
import { StateActiveContainer } from './Container/StateActiveContainer';
import { SplashProvider } from './SplashProvider';
import { ThemeProvider } from './ThemeProvider';
import { WebViewWebEmbedProvider } from './WebViewWebEmbedProvider';

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

const flexStyle = { flex: 1 };

export function KitProvider(props: any = {}) {
  const {
    UIApplicationLaunchOptionsRemoteNotificationKey: launchNotification,
  } = props;

  ColdStartByNotification.launchNotification = launchNotification;

  useDebugComponentRemountLog({ name: 'KitProvider' });
  return (
    <GlobalJotaiReady>
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
          <InAppNotification />
          <SyncHomeAccountToDappAccountProvider />
        </ThemeProvider>
      </GestureHandlerRootView>
    </GlobalJotaiReady>
  );
}
