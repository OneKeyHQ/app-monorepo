import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PlatformEnv from '@onekeyhq/shared/src/platformEnv';
import { Stack } from '../../Stack';
import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import { TransparentModalTheme } from './CommonConfig.ts';
import ModalFlowNavigator from './ModalFlowNavigator';

import type { ModalFlowNavigatorConfig } from './ModalFlowNavigator';

export interface ModalRootNavigatorConfig<RouteName extends string> {
  name: RouteName;
  children: ModalFlowNavigatorConfig<any, any>[];
}

interface ModalNavigatorProps<RouteName extends string> {
  config: ModalRootNavigatorConfig<RouteName>[];
}

const ModalStack = createStackNavigator();

export function RootModalNavigator<RouteName extends string>({
  config,
}: ModalNavigatorProps<RouteName>) {
  const screenOptions = useMemo(() => makeRootModalStackOptions(), []);

  const modalComponents = useMemo(
    () =>
      config.map(({ name, children }) => ({
        name,
        // eslint-disable-next-line react/no-unstable-nested-components
        children: () => <ModalFlowNavigator config={children} />,
      })),
    [config],
  );
  const insets = useSafeAreaInsets();

  return (
    <Stack
      flex={1}
      paddingBottom={
        // iOS Pad Modal not is full screen
        PlatformEnv.isNative && !PlatformEnv.isNativeIOSPad ? insets.bottom : 0
      }
      paddingLeft={insets.left}
      paddingRight={insets.right}
    >
      <ThemeProvider value={TransparentModalTheme}>
        <ModalStack.Navigator screenOptions={screenOptions}>
          {modalComponents.map(({ name, children }) => (
            <ModalStack.Screen key={`ROOT-Modal-${name}`} name={name}>
              {children}
            </ModalStack.Screen>
          ))}
        </ModalStack.Navigator>
      </ThemeProvider>
    </Stack>
  );
}
