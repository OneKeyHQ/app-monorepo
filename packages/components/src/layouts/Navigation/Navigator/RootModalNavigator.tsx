import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ThemeProvider } from '@react-navigation/native';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '../../../content/Theme';
import { EPageType } from '../../../hocs';
import { useTheme, useThemeName } from '../../../hooks';
import { makeRootModalStackOptions } from '../GlobalScreenOptions';
import { createStackNavigator } from '../StackNavigator';

import {
  TransparentDarkModalTheme,
  TransparentModalTheme,
} from './CommonConfig';
import ModalFlowNavigator from './ModalFlowNavigator';
import {
  ModalHorizontalSafeAreaContext,
  shouldApplyHorizontalSafeArea,
} from './ModalHorizontalSafeArea';

import type { IModalFlowNavigatorConfig } from './ModalFlowNavigator';
import type { ViewInstance } from 'react-native';

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

// iPhone Duo places the status bar and camera in a side strip and reports it
// as a horizontal window safe area inset. Modal pages only handle top/bottom
// insets, so keep their content out of that strip, as the tab scenes do. Pad
// only by how far the modal reaches into the window insets: a centered sheet
// in landscape never touches the strip. The native SafeAreaView is not used
// because UIKit reports a stale side inset inside a sheet after rotating back
// to portrait.
//
// The padding is measured here but applied inside each screen: UIKit lays out
// the vertical bar against the navigation controller's edge, so padding around
// the navigator would drag the bar out of the strip and over the page.
const styles = StyleSheet.create({
  horizontalSafeArea: { flex: 1 },
});

function HorizontalSafeAreaModalContent({ children }: { children: ReactNode }) {
  const theme = useTheme();
  // `theme.*.val` reads are non-reactive on native; follow light/dark switches.
  useThemeName();
  const { left, right } = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const viewRef = useRef<ViewInstance>(null);
  const [frame, setFrame] = useState<{ x: number; width: number }>();

  const measureFrame = useCallback(() => {
    viewRef.current?.measureInWindow((x, _y, width) => {
      setFrame((prev) =>
        prev?.x === x && prev?.width === width ? prev : { x, width },
      );
    });
  }, []);

  // Rotation can move the modal without resizing it, so re-measure whenever
  // the window or its insets change, not only on layout.
  useEffect(() => {
    measureFrame();
  }, [measureFrame, windowWidth, left, right]);

  const padding = useMemo(
    () => ({
      paddingLeft: frame ? Math.max(0, left - frame.x) : 0,
      paddingRight: frame
        ? Math.max(0, right - (windowWidth - frame.x - frame.width))
        : 0,
    }),
    [frame, left, right, windowWidth],
  );

  // The padded strip shows this color: pages paint `bgApp`, so the background
  // still reaches the screen edge while content stays inset.
  const style = useMemo(
    () => [styles.horizontalSafeArea, { backgroundColor: theme.bgApp.val }],
    [theme.bgApp.val],
  );

  return (
    <ModalHorizontalSafeAreaContext.Provider value={padding}>
      <View ref={viewRef} style={style} onLayout={measureFrame}>
        {children}
      </View>
    </ModalHorizontalSafeAreaContext.Provider>
  );
}

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
            const content = shouldApplyHorizontalSafeArea ? (
              <HorizontalSafeAreaModalContent>
                {navigator}
              </HorizontalSafeAreaModalContent>
            ) : (
              navigator
            );
            if (!flowTheme) {
              return content;
            }
            return <Theme name={flowTheme}>{content}</Theme>;
          },
        }),
      ),
    [config, pageType],
  );

  return (
    <ThemeProvider value={navigationTheme}>
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
