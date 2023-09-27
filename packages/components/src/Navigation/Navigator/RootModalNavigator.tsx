import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';

import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import { TransparentModalTheme } from './CommonConfig.ts';

import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

interface ModalNavigatorConfig<P extends ParamListBase>
  extends CommonNavigatorConfig<P> {
  disableClose?: boolean;
}

interface ModalNavigatorProps<P extends ParamListBase> {
  config: ModalNavigatorConfig<P>[];
}

export function createModalNavigatorConfig<P extends ParamListBase>(
  config: ModalNavigatorConfig<P>[],
): ModalNavigatorConfig<P>[] {
  return config;
}

const ModalStack = createStackNavigator();

export function RootModalNavigator<P extends ParamListBase>({
  config,
}: ModalNavigatorProps<P>) {
  const screenOptions = useMemo(() => makeRootModalStackOptions(), []);
  return (
    <ThemeProvider value={TransparentModalTheme}>
      <ModalStack.Navigator screenOptions={screenOptions}>
        {config.map(({ name, component, options }) => (
          <ModalStack.Screen
            key={`ROOT-Modal-${name as string}`}
            name={name}
            component={component}
            options={options}
          />
        ))}
      </ModalStack.Navigator>
    </ThemeProvider>
  );
}
