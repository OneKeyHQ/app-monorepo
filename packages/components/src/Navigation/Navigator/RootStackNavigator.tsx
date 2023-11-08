import { useCallback, useMemo } from 'react';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { useThemeValue } from '../../Provider/hooks/useThemeValue';
import {
  clearStackNavigatorOptions,
  makeFullScreenOptions,
  makeModalScreenOptions,
} from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import type { ICommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

type IRootStackType = 'normal' | 'modal' | 'fullScreen';

export interface IRootStackNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends ICommonNavigatorConfig<RouteName, P> {
  initialRoute?: boolean;
  type?: IRootStackType;
  disable?: boolean;
}

interface IRootStackNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: IRootStackNavigatorConfig<RouteName, P>[];
  screenOptions?: Record<any, any>;
}

const RootStack = createStackNavigator<ParamListBase>();

export function RootStackNavigator<
  RouteName extends string,
  P extends ParamListBase,
>({ config, screenOptions = {} }: IRootStackNavigatorProps<RouteName, P>) {
  const initialRouteName = useMemo(
    () => config.find((route) => route.initialRoute)?.name ?? config[0].name,
    [config],
  );

  const bgColor = useThemeValue('bg');
  const isVerticalLayout = useIsVerticalLayout();
  const presetScreenOptions = clearStackNavigatorOptions({
    bgColor,
  });

  const getOptionsWithType = useCallback(
    (type?: IRootStackType) => {
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

  const renderedScreens = useMemo(
    () =>
      config
        .filter(({ disable }) => !disable)
        .map(({ name, component, type, options }) => (
          <RootStack.Screen
            key={name}
            name={name}
            component={component}
            options={{ ...options, ...getOptionsWithType(type) }}
          />
        )),
    [config, getOptionsWithType],
  );

  return useMemo(
    () => (
      <RootStack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          ...presetScreenOptions,
          ...screenOptions,
        }}
      >
        {renderedScreens}
      </RootStack.Navigator>
    ),
    [initialRouteName, presetScreenOptions, renderedScreens, screenOptions],
  );
}
