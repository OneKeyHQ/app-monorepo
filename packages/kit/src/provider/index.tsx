import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toast } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debugUtils';

import { GlobalJotaiReady } from '../components/GlobalJotaiReady';
import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';
import { SystemLocaleTracker } from '../components/SystemLocaleTracker';

import { ColdStartByNotification, Container } from './Container';
import InAppNotification from './Container/InAppNotification';
import { StateActiveContainer } from './Container/StateActiveContainer';
import { SplashProvider } from './SplashProvider';
import { ThemeProvider } from './ThemeProvider';
import { WebViewWebEmbedProvider } from './WebViewWebEmbedProvider';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  globalThis._frameTimestamp = null;
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.$$Toast = Toast;
}

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
          <SplashProvider>
            <Container />
          </SplashProvider>
          <PasswordVerifyPromptMount />
          <WebViewWebEmbedProvider />
          <LastActivityTracker />
          <SystemLocaleTracker />
          <StateActiveContainer />
          <InAppNotification />
        </ThemeProvider>
      </GestureHandlerRootView>
    </GlobalJotaiReady>
  );
}
