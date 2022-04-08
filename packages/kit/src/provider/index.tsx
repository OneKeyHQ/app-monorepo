import React, { FC, useEffect, useState } from 'react';

import axios from 'axios';
import * as SplashScreen from 'expo-splash-screen';
import { Provider as ReduxProvider } from 'react-redux';
import { SWRConfig } from 'swr';

import { Box } from '@onekeyhq/components';
import useRemoteConsole from '@onekeyhq/remote-console/src/useRemoteConsole';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { waitForDataLoaded } from '../background/utils';
import store from '../store';

import EngineApp from './EngineProvider';
import NavigationApp from './NavigationProvider';
import ThemeApp from './ThemeProvider';

function WaitBackgroundReady({
  loading,
  children,
}: {
  loading?: any;
  children: any;
}): any {
  const [ready, setReady] = useState(false);
  const loadingView =
    loading ??
    (process.env.NODE_ENV !== 'production' && <Box>Loading background...</Box>);
  useEffect(() => {
    (async () => {
      await waitForDataLoaded({
        logName: 'WaitBackgroundReady',
        data: async () => {
          const result = await backgroundApiProxy.getState();

          if (result && result.bootstrapped && debugLogger.debug) {
            store.dispatch({
              // TODO use consts
              type: 'REPLACE_WHOLE_STATE',
              payload: result.state,
              $isDispatchFromBackground: true,
            });

            return true;
          }
          return false;
        },
      });
      setReady(true);
    })();
  }, []);

  return ready ? children : loadingView;
}

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => {
  useRemoteConsole();
  useEffect(() => {
    async function prepare() {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch (e) {
        console.log(e);
      }
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
        <ThemeApp>
          {/* <PersistGate loading={null} persistor={persistor}></PersistGate> */}
          <WaitBackgroundReady loading={undefined}>
            <EngineApp>
              <NavigationApp />
            </EngineApp>
          </WaitBackgroundReady>
        </ThemeApp>
      </ReduxProvider>
    </SWRConfig>
  );
};

export default KitProvider;
