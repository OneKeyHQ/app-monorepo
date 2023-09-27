import { useCallback } from 'react';

import { Platform } from 'react-native';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

interface ModalFlowNavigatorConfig<P extends ParamListBase>
  extends CommonNavigatorConfig<P> {
  translationId: string;
  disableClose?: boolean;
}

interface ModalFlowNavigatorProps<P extends ParamListBase> {
  config: ModalFlowNavigatorConfig<P>[];
}

export function createModalFlowNavigatorConfig<P extends ParamListBase>(
  config: ModalFlowNavigatorConfig<P>[],
): ModalFlowNavigatorConfig<P>[] {
  return config;
}

const ModalStack =
  Platform.OS === 'ios' ? createStackNavigator() : createModalNavigator();

export function ModalFlowNavigator<P extends ParamListBase>({
  config,
}: ModalFlowNavigatorProps<P>) {
  const isVerticalLayout = useIsVerticalLayout();

  const makeScreenOptions = useCallback(
    (navInfo) => ({
      ...makeModalStackNavigatorOptions({ navInfo, isVerticalLayout }),
    }),
    [isVerticalLayout],
  );

  return (
    <ModalStack.Navigator screenOptions={makeScreenOptions}>
      {config.map(
        ({ name, component, options, translationId, disableClose }) => {
          const customOptions = {
            ...options,
            gestureEnabled: disableClose,
            title: translationId,
          };

          return (
            <ModalStack.Screen
              key={`Modal-Flow-${name as string}`}
              name={name}
              component={component}
              options={customOptions}
            />
          );
        },
      )}
    </ModalStack.Navigator>
  );
}
