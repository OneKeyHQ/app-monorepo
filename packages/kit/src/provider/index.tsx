import type { FC } from 'react';

import axios from 'axios';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import CustomToast from '@onekeyhq/components/src/Toast/Custom';
import type { NotificationExtra } from '@onekeyhq/engine/src/managers/notification';
import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AppLoading from './AppLoading';
import NavigationApp from './NavigationProvider';
import NotificationProvider from './NotificationProvider';
import ThemeApp from './ThemeProvider';
import { TranslationProvider } from './TranslationProvider';
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
  global.$$onekeyPerfTrace?.log({ name: 'KitProvider render' });
  return (
    <SWRConfig value={swrConfig}>
      <ReduxProvider store={store}>
        <GestureHandlerRootView style={flexStyle}>
          <ThemeApp>
            <AppLoading>
              <ErrorBoundary>
                <TranslationProvider>
                  <NotificationProvider launchNotification={launchNotification}>
                    <RootSiblingParent>
                      <NavigationApp />
                      <WhenAppActive />
                      {platformEnv.isNativeIOS ? (
                        // FullWindowOverlay can render above native views
                        // but can not work with modal
                        // https://github.com/software-mansion/react-native-screens/issues/1149
                        // so now only used for toast
                        <FullWindowOverlay style={StyleSheet.absoluteFill}>
                          <View
                            pointerEvents="box-none"
                            style={StyleSheet.absoluteFill}
                          >
                            <CustomToast bottomOffset={60} />
                          </View>
                        </FullWindowOverlay>
                      ) : (
                        <CustomToast bottomOffset={60} />
                      )}
                    </RootSiblingParent>
                  </NotificationProvider>
                </TranslationProvider>
              </ErrorBoundary>
            </AppLoading>
          </ThemeApp>
        </GestureHandlerRootView>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
