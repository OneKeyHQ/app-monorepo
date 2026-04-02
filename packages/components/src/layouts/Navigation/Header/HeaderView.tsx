import type { ReactNode } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import * as React from 'react';

import { Header } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import { useTheme } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsOverlayPage } from '../../../hocs';
import { useIsDesktopModeUIInTabPages } from '../../../hooks';
import { Stack, XStack } from '../../../primitives';
import { WINDOWS_OVERLAY_BUTTONS_WIDTH } from '../../../utils/sidebar';
import { DesktopDragZoneBox } from '../../DesktopDragZoneBox';

import HeaderBackButton from './HeaderBackButton';
import HeaderSearchBar from './HeaderSearchBar';

import type { IOnekeyStackHeaderProps } from './HeaderScreenOptions';
import type { IDesktopDragZoneBoxProps } from '../../DesktopDragZoneBox';
import type { IStackHeaderProps } from '../ScreenProps';
import type {
  HeaderBackButtonProps,
  HeaderOptions,
  Layout,
} from '@react-navigation/elements';

const HEADER_TRANSPARENT_STYLE = {
  position: 'absolute',
  right: 0,
  left: 0,
} as const;
const EMPTY_HEADER_STYLE = {} as const;
const GT_MD_FLEX_1 = { flex: 1 } as const;
const FLEX_GROW_0_STYLE = { flexGrow: 0 } as const;
const HEADER_TITLE_BASE_STYLE = {
  lineHeight: 28,
  fontWeight: '600',
} as const;
const EMPTY_HEADER_RIGHT_CONTAINER_STYLE = {} as const;
const EMPTY_HEADER_TITLE_CONTAINER_STYLE = {} as const;
const EMPTY_OPTIONS = {} as const;
const GT_MD_FLEX_DIRECTION_ROW = { flexDirection: 'row' } as const;

function getHeaderTitle(
  options: { title?: string; headerTitle?: HeaderOptions['headerTitle'] },
  fallback: string,
): string {
  // eslint-disable-next-line no-nested-ternary
  return typeof options?.headerTitle === 'string'
    ? options?.headerTitle
    : options?.title !== undefined
      ? options?.title
      : fallback;
}

const DesktopDragZoneBoxView = platformEnv.isDesktopWithCustomTitleBar
  ? ({ disabled, children }: IDesktopDragZoneBoxProps) => {
      const isModalPage = useIsOverlayPage();

      const [isFocus, setIsFocus] = useState(false);

      const handlePageEffect = useCallback(() => {
        setIsFocus(true);
        return () => {
          setIsFocus(false);
        };
      }, []);

      useFocusEffect(handlePageEffect);

      return (
        <DesktopDragZoneBox disabled={disabled || !isFocus || isModalPage}>
          {children}
        </DesktopDragZoneBox>
      );
    }
  : DesktopDragZoneBox;

const useHeaderHeight = platformEnv.isNativeIOS
  ? () => 52
  : () => {
      const { top } = useSafeAreaInsets();
      return useMemo(() => 52 + top, [top]);
    };

function HeaderView({
  back: headerBack,
  options,
  route,
  navigation,
  isModelScreen = false,
  isRootScreen = false,
  isOnboardingScreen = false,
}: IStackHeaderProps & IOnekeyStackHeaderProps) {
  const {
    headerLeft,
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerTransparent = false,
    headerStyle,
    headerBackground,
    headerShown = true,
    headerRightContainerStyle = EMPTY_HEADER_RIGHT_CONTAINER_STYLE,
    headerTitleContainerStyle = EMPTY_HEADER_TITLE_CONTAINER_STYLE,
    // native HeaderSearchBar in packages/components/src/layouts/Page/PageHeader.tsx
    headerSearchBarOptions,
    headerTitleStyle,
  } = options || EMPTY_OPTIONS;
  const theme = useTheme();
  const state = navigation?.getState();
  const canGoBack = headerBack !== undefined;
  const topStack = (state?.index ?? 0) === 0;

  const onBackCallback = useCallback(() => {
    if (canGoBack) {
      navigation?.goBack?.();
    } else {
      navigation?.getParent()?.goBack?.();
    }
  }, [canGoBack, navigation]);

  const headerLeftView = useCallback(
    ({
      canGoBack: canGoBackNative,
      onPress,
      ...props
    }: HeaderBackButtonProps & { canGoBack: boolean }): ReactNode => {
      const headerBackButton = (
        <HeaderBackButton
          canGoBack={!topStack}
          onPress={onBackCallback}
          isRootScreen={isRootScreen}
          isModelScreen={isModelScreen}
          isOnboardingScreen={isOnboardingScreen}
          renderLeft={headerLeft}
          {...props}
        />
      );

      return headerBackButton ? (
        <XStack className="app-region-no-drag">{headerBackButton}</XStack>
      ) : null;
    },
    [
      topStack,
      onBackCallback,
      isRootScreen,
      isModelScreen,
      isOnboardingScreen,
      headerLeft,
    ],
  );
  const headerHeight = useHeaderHeight();
  const { gtMd } = useMedia();

  const isGtMd = gtMd && !platformEnv.isNativeAndroid;
  const layout = useMemo(() => {
    if (platformEnv.isNative) {
      return undefined;
    }
    if (isModelScreen) {
      return isGtMd
        ? ({ width: 640 } as Layout)
        : ({ width: window.innerWidth } as Layout);
    }
    return undefined;
  }, [isGtMd, isModelScreen]);

  const isDesktopModeUI = useIsDesktopModeUIInTabPages();
  const headerBackgroundColor = useMemo(() => {
    if (headerTransparent) {
      return 'transparent';
    }
    if (platformEnv.isWebDappMode) {
      return '$bgApp';
    }
    return isDesktopModeUI ? '$bgSubdued' : '$bgApp';
  }, [headerTransparent, isDesktopModeUI]);

  const routeName = route.name;
  const title = useMemo(
    () => getHeaderTitle(options, routeName),
    [routeName, options],
  );
  const headerViewKey = useMemo(
    () => `${title}-${routeName}`,
    [title, routeName],
  );
  const stackStyle = useMemo(
    () =>
      headerTransparent && !platformEnv.isNativeAndroid
        ? HEADER_TRANSPARENT_STYLE
        : EMPTY_HEADER_STYLE,
    [headerTransparent],
  );

  const innerGtMd = useMemo(
    () => (platformEnv.isNativeAndroid ? undefined : GT_MD_FLEX_1),
    [],
  );

  const headerRightContainerStyleMemo = useMemo(
    () => (isOnboardingScreen ? FLEX_GROW_0_STYLE : headerRightContainerStyle),
    [isOnboardingScreen, headerRightContainerStyle],
  );

  const headerRightView = useCallback(
    ({ tintColor }: { tintColor?: string }) => {
      if (typeof headerRight === 'function') {
        return headerRight({ tintColor, canGoBack });
      }
      return headerRight as React.ReactNode;
    },
    [headerRight, canGoBack],
  );

  const headerTitleView = useCallback(
    ({ children, tintColor }: { children: string; tintColor?: string }) => {
      if (typeof headerTitle === 'function') {
        return headerTitle({ children, tintColor });
      }
      return null;
    },
    [headerTitle],
  );

  const headerTitleStyleMemo = useMemo(
    () =>
      headerTitleStyle
        ? {
            ...HEADER_TITLE_BASE_STYLE,
            ...(headerTitleStyle as Record<string, unknown>),
          }
        : HEADER_TITLE_BASE_STYLE,
    [headerTitleStyle],
  );

  const headerTitleContainerStyleMemo = useMemo(
    () => ({
      marginHorizontal: 0,
      ...(headerTitleContainerStyle as Record<string, unknown>),
      ...(isOnboardingScreen
        ? { flex: 1, alignItems: 'center' as const }
        : undefined),
    }),
    [headerTitleContainerStyle, isOnboardingScreen],
  );

  const headerStyleMemo = useMemo(
    () => [{ height: headerHeight }, headerStyle],
    [headerHeight, headerStyle],
  );

  if (!headerShown) {
    return null;
  }

  return (
    <DesktopDragZoneBoxView disabled={isModelScreen}>
      <Stack
        alignItems="center"
        bg={headerBackgroundColor}
        pt={isOnboardingScreen ? '$10' : undefined}
        style={stackStyle}
        pointerEvents="box-none"
        $gtMd={
          !isModelScreen && !platformEnv.isNativeAndroid
            ? GT_MD_FLEX_DIRECTION_ROW
            : undefined
        }
      >
        <Stack
          alignSelf="stretch"
          px={isOnboardingScreen ? '$16' : '$5'}
          pr={
            (platformEnv.isDesktopWin || platformEnv.isDesktopLinux) &&
            !isOnboardingScreen &&
            !isModelScreen
              ? WINDOWS_OVERLAY_BUTTONS_WIDTH
              : undefined
          }
          $gtMd={innerGtMd}
        >
          <Header
            layout={layout}
            title={title}
            key={headerViewKey}
            headerTintColor={theme.text.val}
            headerLeft={headerLeftView as any}
            headerRightContainerStyle={headerRightContainerStyleMemo}
            headerTitleAllowFontScaling={false}
            headerRight={
              typeof headerRight === 'function'
                ? headerRightView
                : (headerRight as any)
            }
            headerTitle={
              typeof headerTitle === 'function' ? headerTitleView : headerTitle
            }
            headerTitleAlign={headerTitleAlign}
            headerTitleStyle={headerTitleStyleMemo}
            headerTitleContainerStyle={headerTitleContainerStyleMemo}
            headerTransparent
            headerBackground={headerBackground}
            headerStyle={headerStyleMemo}
          />
        </Stack>
        {headerSearchBarOptions ? (
          <HeaderSearchBar
            autoFocus={headerSearchBarOptions?.autoFocus}
            placeholder={headerSearchBarOptions?.placeholder}
            onChangeText={headerSearchBarOptions?.onChangeText}
            onSearchTextChange={headerSearchBarOptions?.onSearchTextChange}
            onBlur={headerSearchBarOptions?.onBlur}
            onFocus={headerSearchBarOptions?.onFocus}
            onSearchButtonPress={headerSearchBarOptions?.onSearchButtonPress}
            isModalScreen={isModelScreen}
            addOns={headerSearchBarOptions?.addOns}
            searchBarInputValue={headerSearchBarOptions?.searchBarInputValue}
          />
        ) : null}
      </Stack>
    </DesktopDragZoneBoxView>
  );
}

export default memo(HeaderView);

export { NavBackButton, NavCloseButton } from './HeaderBackButton';
