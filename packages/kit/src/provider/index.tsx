import React, { FC, useEffect } from 'react';

import axios from 'axios';
import * as SplashScreen from 'expo-splash-screen';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SWRConfig } from 'swr';

import store, { persistor } from '../store';

import EngineApp from './EngineProvider';
import NavigationApp from './NavigationProvider';
import ThemeApp from './ThemeProvider';

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => {
  useEffect(() => {
    async function prepare() {
      await SplashScreen.preventAutoHideAsync();
    }
    prepare();
  }, []);

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
        <PersistGate loading={null} persistor={persistor}>
          <ThemeApp>
            <EngineApp>
              <NavigationApp />
            </EngineApp>
          </ThemeApp>
        </PersistGate>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
