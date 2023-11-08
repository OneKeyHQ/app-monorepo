import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import * as React from 'react';

import { Header } from '@react-navigation/elements';
import { get } from 'lodash';
import { StyleSheet } from 'react-native';
import { useTheme } from 'tamagui';

import { DesktopDragZoneBox, Stack } from '../../index';

import HeaderBackButton from './HeaderBackButton';
import HeaderSearchBar from './HeaderSearchBar';

import type { OneKeyStackHeaderProps } from './HeaderScreenOptions';
import type { StackHeaderProps } from '../ScreenProps';
import type {
  HeaderBackButtonProps,
  HeaderOptions,
} from '@react-navigation/elements/src/types';

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

function HeaderView({
  back: headerBack,
  options,
  route,
  navigation,
  isModelScreen = false,
  isRootScreen = false,
}: StackHeaderProps & OneKeyStackHeaderProps) {
  const {
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerStyle,
    headerBackground,
    headerSearchBarOptions,
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
    (props: HeaderBackButtonProps): ReactNode => {
      if (disableClose) return null;

      return (
        <HeaderBackButton
          {...props}
          canGoBack={!topStack}
          onPress={onBackCallback}
          isRootScreen={isRootScreen}
          isModelScreen={isModelScreen}
        />
      );
    },
    [disableClose, isModelScreen, isRootScreen, onBackCallback, topStack],
  );

  return (
    <DesktopDragZoneBox>
      <Stack
        px="$5"
        $gtMd={{
          flexDirection: isModelScreen ? 'column' : 'row',
        }}
        backgroundColor="$bgApp"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderSubdued"
        pointerEvents="box-none"
      >
        <Stack
          {...(!isModelScreen && {
            flex: 1,
          })}
        >
          <Header
            title={getHeaderTitle(options, route.name)}
            headerTintColor={theme.text.val}
            headerLeft={headerLeftView}
            headerRight={
              typeof headerRight === 'function'
                ? ({ tintColor }) => headerRight({ tintColor, canGoBack })
                : headerRight
            }
            headerTitle={
              typeof headerTitle === 'function'
                ? ({ children, tintColor }) =>
                    headerTitle({ children, tintColor })
                : headerTitle
            }
            headerTitleAlign={headerTitleAlign}
            headerTitleStyle={{
              fontSize: 18,
              lineHeight: 28,
              fontWeight: '600',
            }}
            headerTransparent
            headerShadowVisible={false}
            headerBackground={headerBackground}
            headerStyle={[{}, headerStyle]}
          />
        </Stack>
        {!!headerSearchBarOptions && (
          <Stack
            $md={{
              pb: '$4',
              width: '100%',
            }}
            $gtMd={{
              pl: isModelScreen ? '$0' : '$5',
              py: isModelScreen ? '$0' : '$3.5',
              pb: isModelScreen ? '$4' : '$0',
              width: isModelScreen ? '100%' : '$60',
              alignItems: isModelScreen ? 'flex-start' : 'center',
            }}
          >
            <HeaderSearchBar
              placeholder={headerSearchBarOptions?.placeholder}
              onChangeText={headerSearchBarOptions?.onChangeText}
              onBlur={headerSearchBarOptions?.onBlur}
              onFocus={headerSearchBarOptions?.onFocus}
              onSearchButtonPress={headerSearchBarOptions?.onSearchButtonPress}
            />
          </Stack>
        )}
      </Stack>
    </DesktopDragZoneBox>
  );
}

export default memo(HeaderView);
