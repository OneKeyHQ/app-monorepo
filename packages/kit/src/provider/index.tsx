import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyPromptMount from '../components/Password/container/PasswordVerifyPromptMount';

import { Container } from './Container';
import { SplashProvider } from './SplashProvider';
import { ThemeProvider } from './ThemeProvider';

if (platformEnv.isRuntimeBrowser) {
  // FIXME need reanimated update, see https://github.com/software-mansion/react-native-reanimated/issues/3355
  // @ts-ignore
  window._frameTimestamp = null;
}

const flexStyle = { flex: 1 };

enableFreeze();

export function KitProvider() {
  return (
    <ThemeProvider>
      <SplashProvider>
        <GestureHandlerRootView style={flexStyle}>
          <Container />
        </GestureHandlerRootView>
      </SplashProvider>
      <PasswordVerifyPromptMount />
    </ThemeProvider>
  );
}
