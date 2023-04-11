import type { FC } from 'react';

import axios from 'axios';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import type { NotificationExtra } from '@onekeyhq/engine/src/managers/notification';
import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AppLoading from './AppLoading';
import NavigationProvider from './NavigationProvider';
import NotificationProvider from './NotificationProvider';
import ThemeProvider from './ThemeProvider';
import { WhenAppActive } from './WhenAppActive';

type LaunchProps = {
  UIApplicationLaunchOptionsRemoteNotificationKey?: NotificationExtra;
};

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  window._frameTimestamp = null;
}

const swrConfig = {
  refreshInterval: 0,
  // @ts-ignore
  fetcher: async (resource, init) => {
    const result = await axios(resource, init);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result.data;
  },
};

const flexStyle = { flex: 1 };

// TODO: detect network change & APP in background mode
const KitProvider: FC<LaunchProps> = (propsRaw) => {
  const props = propsRaw || {};
  const {
    UIApplicationLaunchOptionsRemoteNotificationKey: launchNotification,
  } = props;
  global.$$onekeyPerfTrace?.log({
    name: 'KitProvider render',
    payload: props,
  });
  return (
    <SWRConfig value={swrConfig}>
      <ReduxProvider store={store}>
        <GestureHandlerRootView style={flexStyle}>
          <ThemeProvider>
            <AppLoading>
              <ErrorBoundary>
                <NotificationProvider launchNotification={launchNotification} />
                <NavigationProvider />
                <WhenAppActive />
              </ErrorBoundary>
            </AppLoading>
          </ThemeProvider>
        </GestureHandlerRootView>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
