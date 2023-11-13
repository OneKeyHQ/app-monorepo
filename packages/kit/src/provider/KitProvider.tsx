import { type FC, Fragment } from 'react';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootSiblingParent } from 'react-native-root-siblings';
import { FullWindowOverlay, enableFreeze } from 'react-native-screens';
import { Provider as ReduxProvider } from 'react-redux';

import { Portal, Toaster } from '@onekeyhq/components';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';

import AppLoading from './AppLoading';
import NavigationProvider from './NavigationProvider';
import ThemeProvider from './ThemeProvider';
import { WebTabBarItem } from './WebTabBarItem';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  window._frameTimestamp = null;
}

const flexStyle = { flex: 1 };

enableFreeze();

// Importing FullWindowOverlay is only valid on iOS devices.
const FullWindowOverlayContainer = platformEnv.isNativeIOS
  ? FullWindowOverlay
  : Fragment;

// TODO: detect network change & APP in background mode
const KitProvider: FC = () => (
  <ReduxProvider store={store}>
    <ThemeProvider>
      <AppLoading>
        <RootSiblingParent>
          <GestureHandlerRootView style={flexStyle}>
            <NavigationProvider />
            <FullWindowOverlayContainer>
              <Portal.Container
                name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}
              />
              {platformEnv.isDesktop ? (
                <Portal.Body container={Portal.Constant.WEB_TAB_BAR}>
                  <WebTabBarItem />
                </Portal.Body>
              ) : null}
              <Toaster />
            </FullWindowOverlayContainer>
          </GestureHandlerRootView>
        </RootSiblingParent>
      </AppLoading>
      <PasswordVerifyPromptMount />
    </ThemeProvider>
  </ReduxProvider>
);

export default KitProvider;
