import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useThemeValue } from '../../Provider/hooks/useThemeValue';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig.ts';

import type { ICommonNavigatorConfig } from './types';
import type { ILocaleIds } from '../../locale';
import type { IModalNavigationOptions } from '../ScreenProps';
import type { RouteProp } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/routers';

export interface IModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends ICommonNavigatorConfig<RouteName, P> {
  translationId?: ILocaleIds | string;
  allowDisableClose?: boolean;
  disableClose?: boolean;
}

interface IModalFlowNavigatorProps<
  RouteName extends string,
  P extends ParamListBase,
> {
  config: IModalFlowNavigatorConfig<RouteName, P>[];
}

const ModalStack = hasStackNavigatorModal
  ? createStackNavigator()
  : createModalNavigator();

function ModalFlowNavigator<RouteName extends string, P extends ParamListBase>({
  config,
}: IModalFlowNavigatorProps<RouteName, P>) {
  const [bgColor, titleColor] = useThemeValue(['bg', 'text']);
  const intl = useIntl();

  const makeScreenOptions = useCallback(
    (navInfo: { route: RouteProp<any>; navigation: any }) => ({
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
          const customOptions: IModalNavigationOptions = {
            ...options,
            allowDisableClose,
            disableClose,
            title: translationId
              ? intl.formatMessage({
                  id: translationId as ILocaleIds,
                })
              : '',
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
