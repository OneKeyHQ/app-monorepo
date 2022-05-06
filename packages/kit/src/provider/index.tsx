import React, { FC } from 'react';

import axios from 'axios';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import { ErrorBoundary } from '@onekeyhq/kit/src/components/ErrorBoundary';
import store from '@onekeyhq/kit/src/store';
import useRemoteConsole from '@onekeyhq/remote-console/src/useRemoteConsole';

import AppLoading from './AppLoading';
import NavigationApp from './NavigationProvider';
import ThemeApp from './ThemeProvider';

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => {
  useRemoteConsole();
  return (
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
        <ThemeApp>
          <AppLoading>
            <ErrorBoundary>
              <NavigationApp />
            </ErrorBoundary>
          </AppLoading>
        </ThemeApp>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
