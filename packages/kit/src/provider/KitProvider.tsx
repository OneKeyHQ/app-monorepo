import { type FC } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Portal } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AppLoading from './AppLoading';
import NavigationProvider from './NavigationProvider';
import Provider from './ThemeProvider';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  window._frameTimestamp = null;
}

const flexStyle = { flex: 1 };

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => (
  <Provider>
    <AppLoading>
      <GestureHandlerRootView style={flexStyle}>
        <NavigationProvider />
      </GestureHandlerRootView>
    </AppLoading>
    <Portal />
  </Provider>
);

export default KitProvider;
