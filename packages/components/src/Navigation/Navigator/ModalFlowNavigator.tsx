import { memo, useCallback } from 'react';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig.ts';

import type { ModalNavigationOptions } from '../ScreenProps';
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

const ModalStack = hasStackNavigatorModal
  ? createStackNavigator()
  : createModalNavigator();

function ModalFlowNavigator<RouteName extends string, P extends ParamListBase>({
  config,
}: ModalFlowNavigatorProps<RouteName, P>) {
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
          const customOptions: ModalNavigationOptions = {
            ...options,
            disableClose,
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

export default memo(ModalFlowNavigator);
