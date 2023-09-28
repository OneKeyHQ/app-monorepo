import { useCallback } from 'react';

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

export interface RootStackNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  initialRoute?: boolean;
  type?: RootStackType;
}

interface RootStackNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: RootStackNavigatorConfig<RouteName, P>[];
  screenOptions?: Record<any, any>;
}

const RootStack = createStackNavigator<ParamListBase>();

export function RootStackNavigator<
  RouteName extends string,
  P extends ParamListBase,
>({ config, screenOptions = {} }: RootStackNavigatorProps<RouteName, P>) {
  const initialRouteName =
    config.find((route) => route.initialRoute)?.name ?? config[0].name;

  const bgColor = useThemeValue('bg');
  const isVerticalLayout = useIsVerticalLayout();
  const presetScreenOptions = clearStackNavigatorOptions({
    bgColor: bgColor as string,
  });

  const getOptionsWithType = useCallback(
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
          options={{ ...options, ...getOptionsWithType(type) }}
        />
      ))}
    </RootStack.Navigator>
  );
}
