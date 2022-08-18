import React, { FC } from 'react';

import axios from 'axios';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';
import store from '@onekeyhq/kit/src/store';

import AppLoading from './AppLoading';
import NavigationApp from './NavigationProvider';
import NotificationProvider from './NotificationProvider';
import ThemeApp from './ThemeProvider';

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => (
  <SWRConfig
    value={{
      refreshInterval: 0,
      fetcher: async (resource, init) => {
        const result = await axios(resource, init);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result.data;
      },
    }}
  >
    <ReduxProvider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeApp>
          <AppLoading>
            <ErrorBoundary>
              <NotificationProvider>
                <NavigationApp />
              </NotificationProvider>
            </ErrorBoundary>
          </AppLoading>
        </ThemeApp>
      </GestureHandlerRootView>
    </ReduxProvider>
  </SWRConfig>
);

export default KitProvider;
