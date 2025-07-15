import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';
import * as React from 'react';

import { Header } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { get } from 'lodash';
import { useMedia, useTheme } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EPageType, usePageType } from '../../../hocs';
import { Stack, XStack } from '../../../primitives';
import { DesktopDragZoneBox } from '../../DesktopDragZoneBox';
import { rootNavigationRef } from '../Navigator/NavigationContainer';

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

const useIsTabFocused = () => {
  const isFocused = useIsFocused();

  if ((rootNavigationRef.current?.getState().routes.length || 0) > 1) {
    return true;
  }
  return isFocused;
};

const DesktopDragZoneBoxView = platformEnv.isDesktop
  ? ({ disabled, children }: IDesktopDragZoneBoxProps) => {
      const isPageFocus = useIsTabFocused();
      const pageType = usePageType();
      return (
        <DesktopDragZoneBox
          disabled={disabled || !isPageFocus || pageType === EPageType.modal}
        >
          {children}
        </DesktopDragZoneBox>
      );
    }
  : DesktopDragZoneBox;

function HeaderView({
  back: headerBack,
  options,
  route,
  navigation,
  isModelScreen = false,
  isRootScreen = false,
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
    headerRightContainerStyle = {},
    headerTitleContainerStyle = {},
    // native HeaderSearchBar in packages/components/src/layouts/Page/PageHeader.tsx
    headerSearchBarOptions,
    headerTitleStyle,
  } = options || {};
  const theme = useTheme();
  const state = navigation?.getState();
  const canGoBack = headerBack !== undefined;
  const topStack = (state?.index ?? 0) === 0;
  const disableClose = get(options, 'disableClose', false);

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
          disableClose={disableClose}
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
      disableClose,
      headerLeft,
    ],
  );

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
  if (!headerShown) {
    return null;
  }

  return (
    <DesktopDragZoneBoxView disabled={isModelScreen}>
      <Stack
        alignItems="center"
        bg={headerTransparent ? 'transparent' : '$bgApp'}
        style={
          headerTransparent && !platformEnv.isNativeAndroid
            ? { position: 'absolute', right: 0, left: 0 }
            : {}
        }
        // borderBottomWidth={StyleSheet.hairlineWidth}
        // borderBottomColor="$borderSubdued"
        pointerEvents="box-none"
        {...(!isModelScreen && {
          $gtMd: platformEnv.isNativeAndroid
            ? undefined
            : {
                flexDirection: 'row',
              },
        })}
      >
        <Stack
          alignSelf="stretch"
          px="$5"
          $gtMd={
            platformEnv.isNativeAndroid
              ? undefined
              : {
                  flex: 1,
                }
          }
        >
          <Header
            layout={layout}
            title={getHeaderTitle(options, route.name)}
            headerTintColor={theme.text.val}
            headerLeft={headerLeftView as any}
            headerRightContainerStyle={headerRightContainerStyle}
            headerRight={
              typeof headerRight === 'function'
                ? ({ tintColor }) => {
                    const ele = headerRight({ tintColor, canGoBack });
                    return ele;
                  }
                : (headerRight as any)
            }
            headerTitle={
              typeof headerTitle === 'function'
                ? ({ children, tintColor }) =>
                    headerTitle({ children, tintColor })
                : headerTitle
            }
            headerTitleAlign={headerTitleAlign}
            headerTitleStyle={{
              lineHeight: 28,
              fontWeight: '600',
              ...(headerTitleStyle as any),
            }}
            headerTitleContainerStyle={{
              marginHorizontal: 0,
              ...(headerTitleContainerStyle as any),
            }}
            headerTransparent
            headerBackground={headerBackground}
            headerStyle={[
              {
                height: 52,
              },
              headerStyle,
            ]}
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
          />
        ) : null}
      </Stack>
    </DesktopDragZoneBoxView>
  );
}

export default memo(HeaderView);

export { NavBackButton, NavCloseButton } from './HeaderBackButton';
