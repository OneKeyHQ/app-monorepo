import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';

import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import { TransparentModalTheme } from './CommonConfig';
import ModalFlowNavigator from './ModalFlowNavigator';

import type { IModalFlowNavigatorConfig } from './ModalFlowNavigator';
import type { EPageType } from '../../../hocs';

export interface IModalRootNavigatorConfig<RouteName extends string> {
  name: RouteName;
  children: IModalFlowNavigatorConfig<any, any>[];
  onMounted?: () => void;
  onUnmounted?: () => void;
  rewrite?: string;
  exact?: boolean;
}

interface IModalNavigatorProps<RouteName extends string> {
  config: IModalRootNavigatorConfig<RouteName>[];
}

const ModalStack = createStackNavigator();

export function RootModalNavigator<RouteName extends string>({
  config,
  pageType,
}: IModalNavigatorProps<RouteName> & { pageType?: EPageType }) {
  const screenOptions = useMemo(() => makeRootModalStackOptions(), []);

  const modalComponents = useMemo(
    () =>
      config.map(({ name, children, onMounted, onUnmounted }) => ({
        name,
        // eslint-disable-next-line react/no-unstable-nested-components
        children: () => (
          <ModalFlowNavigator
            config={children}
            pageType={pageType}
            name={name}
            onMounted={onMounted}
            onUnmounted={onUnmounted}
          />
        ),
      })),
    [config, pageType],
  );

  return (
    <ThemeProvider value={TransparentModalTheme}>
      <ModalStack.Navigator screenOptions={screenOptions}>
        {modalComponents.map(({ name, children }) => (
          <ModalStack.Screen key={`ROOT-Modal-${name}`} name={name}>
            {children}
          </ModalStack.Screen>
        ))}
      </ModalStack.Navigator>
    </ThemeProvider>
  );
}
