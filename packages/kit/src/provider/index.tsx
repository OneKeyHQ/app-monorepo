import React, { FC, Fragment } from 'react';

import axios from 'axios';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { FullWindowOverlay } from 'react-native-screens';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import CustomToast from '@onekeyhq/components/src/Toast/Custom';
import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AppLoading from './AppLoading';
import NavigationApp from './NavigationProvider';
import NotificationProvider from './NotificationProvider';
import ThemeApp from './ThemeProvider';

// FullWindowOverlay can render above native views
// but can not work with modal
// https://github.com/software-mansion/react-native-screens/issues/1149
// so now only used for toast
const ToastOverlayIOS = FullWindowOverlay;
const ToastOverlayNormal = Fragment;

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
const KitProvider: FC = () => {
  const toastElement = (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <CustomToast bottomOffset={60} />
    </View>
  );
  return (
    <SWRConfig value={swrConfig}>
      <ReduxProvider store={store}>
        <GestureHandlerRootView style={flexStyle}>
          <ThemeApp>
            <AppLoading>
              <ErrorBoundary>
                <NotificationProvider>
                  <RootSiblingParent>
                    <NavigationApp />
                    {platformEnv.isNativeIOS ? (
                      <ToastOverlayIOS style={StyleSheet.absoluteFill}>
                        {toastElement}
                      </ToastOverlayIOS>
                    ) : (
                      <ToastOverlayNormal>{toastElement}</ToastOverlayNormal>
                    )}
                  </RootSiblingParent>
                </NotificationProvider>
              </ErrorBoundary>
            </AppLoading>
          </ThemeApp>
        </GestureHandlerRootView>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
