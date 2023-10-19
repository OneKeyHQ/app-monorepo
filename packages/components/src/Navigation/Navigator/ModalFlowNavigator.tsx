import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useThemeValue } from '../../Provider/hooks/useThemeValue';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig.ts';

import type { LocaleIds } from '../../locale';
import type { ModalNavigationOptions } from '../ScreenProps';
import type { CommonNavigatorConfig } from './types';
import type { ParamListBase } from '@react-navigation/routers';

export interface ModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId: LocaleIds;
  allowDisableClose?: boolean;
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
  const [bgColor, titleColor] = useThemeValue(['bg', 'text']);
  const intl = useIntl();

  const makeScreenOptions = useCallback(
    (navInfo) => ({
      ...makeModalStackNavigatorOptions({
        navInfo,
        bgColor,
        titleColor,
      }),
    }),
    [bgColor, titleColor],
  );

  return (
    // @ts-expect-error
    <ModalStack.Navigator screenOptions={makeScreenOptions}>
      {config.map(
        ({
          name,
          component,
          options,
          translationId,
          allowDisableClose,
          disableClose,
        }) => {
          const customOptions: ModalNavigationOptions = {
            ...options,
            allowDisableClose,
            disableClose,
            title: intl.formatMessage({
              id: translationId,
            }),
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
