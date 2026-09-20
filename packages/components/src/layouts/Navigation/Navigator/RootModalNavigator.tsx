import { useMemo } from 'react';

import { ThemeProvider } from '@react-navigation/native';

import { getTokenValue } from '@onekeyhq/components/src/shared/tamagui';

import { Theme } from '../../../content/Theme';
import { EPageType } from '../../../hocs';
import { useTheme } from '../../../hooks';
import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import {
  TransparentDarkModalTheme,
  TransparentModalTheme,
} from './CommonConfig';
import { ForcedThemeSystemBars } from './ForcedThemeSystemBars';
import ModalFlowNavigator from './ModalFlowNavigator';

import type { IModalFlowNavigatorConfig } from './ModalFlowNavigator';

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
  const navigationTheme =
    pageType === EPageType.onboarding
      ? TransparentDarkModalTheme
      : TransparentModalTheme;

  const screenOptions = useMemo(
    () => makeRootModalStackOptions({ bgColor }),
    [bgColor],
  );

  const forcedThemeBackgroundColorByTheme = useMemo(
    () => ({
      dark: getTokenValue('$bgAppDark', 'color') as string,
      light: getTokenValue('$bgAppLight', 'color') as string,
    }),
    [],
  );

  const modalComponents = useMemo(
    () =>
      config.map(
        ({ name, children, onMounted, onUnmounted, theme: flowTheme }) => ({
          name,
          options: flowTheme
            ? makeRootModalStackOptions({
                bgColor: forcedThemeBackgroundColorByTheme[flowTheme],
              })
            : undefined,
          // eslint-disable-next-line react/no-unstable-nested-components
          children: () => {
            const navigator = (
              <ModalFlowNavigator
                config={children}
                pageType={pageType}
                name={name}
                onMounted={onMounted}
                onUnmounted={onUnmounted}
                flowTheme={flowTheme}
              />
            );
            if (!flowTheme) {
              return navigator;
            }
            return (
              <Theme name={flowTheme}>
                <ForcedThemeSystemBars theme={flowTheme} owner={String(name)} />
                {navigator}
              </Theme>
            );
          },
        }),
      ),
    [config, forcedThemeBackgroundColorByTheme, pageType],
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <ModalStack.Navigator screenOptions={screenOptions}>
        {modalComponents.map(({ name, children, options }) => (
          <ModalStack.Screen
            key={`ROOT-Modal-${name}`}
            name={name}
            options={options}
          >
            {children}
          </ModalStack.Screen>
        ))}
      </ModalStack.Navigator>
    </ThemeProvider>
  );
}
