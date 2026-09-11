import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';

import { Theme } from '../../../content/Theme';
import { useTheme } from '../../../hooks';
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
  theme?: 'light' | 'dark';
}

interface IModalNavigatorProps<RouteName extends string> {
  config: IModalRootNavigatorConfig<RouteName>[];
}

const ModalStack = createStackNavigator();

export function RootModalNavigator<RouteName extends string>({
  config,
  pageType,
}: IModalNavigatorProps<RouteName> & { pageType?: EPageType }) {
  const theme = useTheme();
  const bgColor = theme.bgApp.val;

  const screenOptions = useMemo(
    () => makeRootModalStackOptions({ bgColor }),
    [bgColor],
  );

  const modalComponents = useMemo(
    () =>
      config.map(
        ({ name, children, onMounted, onUnmounted, theme: flowTheme }) => ({
          name,
          // eslint-disable-next-line react/no-unstable-nested-components
          children: () => {
            const navigator = (
              <ModalFlowNavigator
                config={children}
                pageType={pageType}
                name={name}
                onMounted={onMounted}
                onUnmounted={onUnmounted}
              />
            );
            if (!flowTheme) {
              return navigator;
            }
            return <Theme name={flowTheme}>{navigator}</Theme>;
          },
        }),
      ),
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
