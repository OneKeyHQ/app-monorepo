import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PlatformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../Stack';
import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import { TransparentModalTheme } from './CommonConfig.ts';
import ModalFlowNavigator from './ModalFlowNavigator';

import type { IModalFlowNavigatorConfig } from './ModalFlowNavigator';

export interface IModalRootNavigatorConfig<RouteName extends string> {
  name: RouteName;
  children: IModalFlowNavigatorConfig<any, any>[];
}

interface IModalNavigatorProps<RouteName extends string> {
  config: IModalRootNavigatorConfig<RouteName>[];
}

const ModalStack = createStackNavigator();

export function RootModalNavigator<RouteName extends string>({
  config,
}: IModalNavigatorProps<RouteName>) {
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

  // iOS Pad Modal not is full screen
  const modalStyle =
    PlatformEnv.isNative && !PlatformEnv.isNativeIOSPad
      ? {
          paddingBottom: insets.bottom,
          bg: '$bgApp',
        }
      : {};

  return (
    <Stack
      flex={1}
      paddingLeft={insets.left}
      paddingRight={insets.right}
      {...modalStyle}
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
