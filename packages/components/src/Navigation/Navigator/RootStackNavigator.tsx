import { useCallback, useMemo } from 'react';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { useThemeValue } from '../../Provider/hooks/useThemeValue';
import {
  clearStackNavigatorOptions,
  makeFullScreenOptions,
  makeModalScreenOptions,
} from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

type RootStackType = 'normal' | 'modal' | 'fullScreen';

interface RootStackNavigatorConfig<P extends ParamListBase>
  extends CommonNavigatorConfig<P> {
  initialRoute?: boolean;
  type?: RootStackType;
}

interface RootStackNavigatorProps<P extends ParamListBase> {
  config: RootStackNavigatorConfig<P>[];
  screenOptions?: Record<any, any>;
}

export function createRootNavigatorConfig<P extends ParamListBase>(
  config: RootStackNavigatorConfig<P>[],
): RootStackNavigatorConfig<P>[] {
  return config;
}

const RootStack = createStackNavigator<ParamListBase>();

export function RootStackNavigator<P extends ParamListBase>({
  config,
  screenOptions,
}: RootStackNavigatorProps<P>) {
  const initialRouteName =
    config.find((route) => route.initialRoute)?.name ?? config[0].name;

  const bgColor = useThemeValue('bg');
  const isVerticalLayout = useIsVerticalLayout();
  const presetScreenOptions = clearStackNavigatorOptions({
    bgColor: bgColor as string,
  });

  const presetOptions = useCallback(
    (type?: RootStackType) => {
      switch (type) {
        case 'modal':
          return makeModalScreenOptions({ isVerticalLayout });
        case 'fullScreen':
          return makeFullScreenOptions();
        default:
          return {};
      }
    },
    [isVerticalLayout],
  );

  return (
    <RootStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        ...presetScreenOptions,
        ...screenOptions,
      }}
    >
      {config.map(({ name, component, type, options }) => (
        <RootStack.Screen
          key={name}
          name={name}
          component={component}
          options={{ ...options, ...presetOptions(type) }}
        />
      ))}
    </RootStack.Navigator>
  );
}
