import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { ILocaleIds } from '@onekeyhq/shared/src/locale';

import { EPageType, PageTypeHOC } from '../../../hocs';
import { useThemeValue } from '../../../hooks';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig';

import type { ICommonNavigatorConfig, IScreenOptionsInfo } from './types';
import type { IModalNavigationOptions } from '../ScreenProps';
import type { ParamListBase } from '@react-navigation/routers';

export interface IModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends ICommonNavigatorConfig<RouteName, P> {
  translationId?: ILocaleIds | string;
  allowDisableClose?: boolean;
  disableClose?: boolean;
  shouldPopOnClickBackdrop?: boolean;
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
  const [bgColor, titleColor] = useThemeValue(['bgApp', 'text']);
  const intl = useIntl();

  const makeScreenOptions = useCallback(
    (optionsInfo: IScreenOptionsInfo<any>) => ({
      ...makeModalStackNavigatorOptions({
        optionsInfo,
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
          shouldPopOnClickBackdrop,
        }) => {
          const customOptions: IModalNavigationOptions = {
            ...options,
            allowDisableClose,
            disableClose,
            shouldPopOnClickBackdrop,
            title: translationId
              ? intl.formatMessage({
                  id: translationId as ILocaleIds,
                })
              : '',
          };
          const key = `Modal-Flow-${name as string}`;
          return (
            <ModalStack.Screen
              key={key}
              name={name}
              component={PageTypeHOC(key, EPageType.modal, component)}
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
