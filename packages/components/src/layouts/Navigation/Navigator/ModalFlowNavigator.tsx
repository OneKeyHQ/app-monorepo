import type { ComponentType } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useThemeValue } from '../../../hooks';
import { NavigationContext } from '../context';
import { makeModalStackNavigatorOptions } from '../GlobalScreenOptions';
import createModalNavigator from '../Modal/createModalNavigator';
import { createStackNavigator } from '../StackNavigator';

import { hasStackNavigatorModal } from './CommonConfig';

import type { ICommonNavigatorConfig, IScreenOptionsInfo } from './types';
import type { ILocaleIds } from '../../../locale';
import type { INavigationContextType } from '../context';
import type { IModalNavigationOptions } from '../ScreenProps';
import type { ParamListBase } from '@react-navigation/routers';

export interface IModalFlowNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> extends ICommonNavigatorConfig<RouteName, P> {
  translationId?: ILocaleIds | string;
  allowDisableClose?: boolean;
  disableClose?: boolean;
}

const map = new Map();
const makeModalComponent = (Component: ComponentType<any>) => {
  if (map.get(Component)) {
    return map.get(Component) as ComponentType<any>;
  }
  function ModalContainer(props: any) {
    const value = useMemo(
      () =>
        ({
          pageType: 'modal',
        } as INavigationContextType),
      [],
    );

    return (
      <NavigationContext.Provider value={value}>
        <Component {...props} pageType="modal" />
      </NavigationContext.Provider>
    );
  }
  map.set(Component, ModalContainer);
  return ModalContainer;
};

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
              component={makeModalComponent(component)}
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
