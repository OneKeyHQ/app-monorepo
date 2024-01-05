import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import * as React from 'react';

import { Header } from '@react-navigation/elements';
import { get } from 'lodash';
import { useTheme } from 'tamagui';

import { Stack } from '../../../primitives';
import { DesktopDragZoneBox } from '../../DesktopDragZoneBox';

import HeaderBackButton from './HeaderBackButton';
import HeaderSearchBar from './HeaderSearchBar';

import type { IOnekeyStackHeaderProps } from './HeaderScreenOptions';
import type { IStackHeaderProps } from '../ScreenProps';
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
}: IStackHeaderProps & IOnekeyStackHeaderProps) {
  const {
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerTransparent = false,
    headerStyle,
    headerBackground,
    headerShown = true,
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
          canGoBack={!topStack}
          onPress={onBackCallback}
          isRootScreen={isRootScreen}
          isModelScreen={isModelScreen}
          {...props}
        />
      );
    },
    [disableClose, isModelScreen, isRootScreen, onBackCallback, topStack],
  );

  if (!headerShown) {
    return null;
  }
  return (
    <DesktopDragZoneBox disabled={isModelScreen}>
      <Stack
        alignItems="center"
        bg={!headerTransparent ? '$bgApp' : 'transparent'}
        style={
          headerTransparent ? { position: 'absolute', right: 0, left: 0 } : {}
        }
        // borderBottomWidth={StyleSheet.hairlineWidth}
        // borderBottomColor="$borderSubdued"
        pointerEvents="box-none"
        {...(!isModelScreen && {
          $gtMd: {
            flexDirection: 'row',
          },
        })}
      >
        <Stack
          alignSelf="stretch"
          px="$5"
          $gtMd={{
            flex: 1,
          }}
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
              lineHeight: 28,
              fontWeight: '600',
            }}
            headerTitleContainerStyle={{
              marginHorizontal: 0,
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
        {!!headerSearchBarOptions && (
          <HeaderSearchBar
            autoFocus={headerSearchBarOptions?.autoFocus}
            placeholder={headerSearchBarOptions?.placeholder}
            onChangeText={headerSearchBarOptions?.onChangeText}
            onBlur={headerSearchBarOptions?.onBlur}
            onFocus={headerSearchBarOptions?.onFocus}
            onSearchButtonPress={headerSearchBarOptions?.onSearchButtonPress}
            isModalScreen={isModelScreen}
          />
        )}
      </Stack>
    </DesktopDragZoneBox>
  );
}

export default memo(HeaderView);
