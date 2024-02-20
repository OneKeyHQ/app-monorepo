import { useCallback, useMemo } from 'react';

import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useThemeValue } from '../../../hooks';
import {
  clearStackNavigatorOptions,
  makeFullScreenOptions,
  makeModalScreenOptions,
} from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import type { ICommonNavigatorConfig, IScreenOptionsInfo } from './types';
import type { ParamListBase } from '@react-navigation/routers';

type IRootStackType = 'normal' | 'modal' | 'fullScreen' | 'iOSFullScreen';

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
  const isVerticalLayout = useMedia().md;
  const presetScreenOptions = clearStackNavigatorOptions({
    bgColor,
  });

  const getOptionsWithType = useCallback(
    (
      type: IRootStackType | undefined,
      optionsInfo: IScreenOptionsInfo<any>,
    ) => {
      switch (type) {
        case 'modal':
          return makeModalScreenOptions({ isVerticalLayout, optionsInfo });
        case 'fullScreen':
          return makeFullScreenOptions();
        case 'iOSFullScreen':
          return platformEnv.isNative
            ? makeFullScreenOptions()
            : makeModalScreenOptions({ isVerticalLayout, optionsInfo });
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
            options={(optionsInfo) => ({
              ...options,
              ...getOptionsWithType(type, optionsInfo),
            })}
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
