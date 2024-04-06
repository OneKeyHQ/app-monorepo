import { GestureHandlerRootView } from 'react-native-gesture-handler';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { GlobalJotaiReady } from '../components/GlobalJotaiReady';
import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';

import { Container } from './Container';
import { SplashProvider } from './SplashProvider';
import { ThemeProvider } from './ThemeProvider';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  window._frameTimestamp = null;
}

const LastActivityTracker = LazyLoad(
  () => import('../components/LastActivityTracker'),
  3000,
);

const flexStyle = { flex: 1 };

export function KitProvider() {
  return (
    <GlobalJotaiReady>
      <ThemeProvider>
        <SplashProvider>
          <GestureHandlerRootView style={flexStyle}>
            <Container />
          </GestureHandlerRootView>
        </SplashProvider>
        <PasswordVerifyPromptMount />
        <LastActivityTracker />
      </ThemeProvider>
    </GlobalJotaiReady>
  );
}
