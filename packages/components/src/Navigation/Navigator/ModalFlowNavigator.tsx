import { useCallback } from 'react';

import { Platform } from 'react-native';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import type { StackNavigationOptions } from '../StackNavigator';
import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

export interface ModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId: string;
  disableClose?: boolean;
}

interface ModalFlowNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: ModalFlowNavigatorConfig<RouteName, P>[];
}

const ModalStack =
  Platform.OS === 'ios' ? createStackNavigator() : createModalNavigator();

export function ModalFlowNavigator<
  RouteName extends string,
  P extends ParamListBase,
>({ config }: ModalFlowNavigatorProps<RouteName, P>) {
  const isVerticalLayout = useIsVerticalLayout();

  const makeScreenOptions = useCallback(
    (navInfo) => ({
      ...makeModalStackNavigatorOptions({ navInfo, isVerticalLayout }),
    }),
    [isVerticalLayout],
  );

  return (
    // @ts-expect-error
    <ModalStack.Navigator screenOptions={makeScreenOptions}>
      {config.map(
        ({ name, component, options, translationId, disableClose }) => {
          const customOptions: StackNavigationOptions = {
            ...options,
            gestureEnabled: disableClose,
            title: translationId,
          };

          return (
            <ModalStack.Screen
              key={`Modal-Flow-${name as string}`}
              name={name}
              component={component}
              // @ts-expect-error
              options={customOptions}
            />
          );
        },
      )}
    </ModalStack.Navigator>
  );
}
