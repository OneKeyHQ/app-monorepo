import { type FC } from 'react';

import StorybookUI from '@onekeyhq/components/.storybook-native/index';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  </Provider>
);

// eslint-disable-next-line import/no-mutable-exports
let AppEntryPoint = KitProvider;
if (process.env.STORYBOOK_ENABLED) {
  AppEntryPoint = StorybookUI;
}
export default AppEntryPoint;
