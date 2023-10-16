import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import * as React from 'react';

import { Header } from '@react-navigation/elements';
import { get } from 'lodash';
import { StyleSheet } from 'react-native';

import { Stack, useThemeValue } from '../../index';

import HeaderButtonBack from './HeaderButtonBack';
import HeaderSearchBar from './HeaderSearchBar';

import type { StackHeaderProps } from '../ScreenProps';
import type { OneKeyStackHeaderProps } from './HeaderScreenOptions';
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
    headerTransparent,
    headerBackground,
    headerSearchBarOptions,
  } = options || {};

  const headerTintColor = useThemeValue('text');

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
        <HeaderButtonBack
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
    <Stack
      px="$5"
      $md={{
        flexDirection: 'column',
      }}
      $gtMd={{
        flexDirection: isModelScreen ? 'column' : 'row',
      }}
      borderTopLeftRadius={isModelScreen ? '$2' : 0}
      borderTopRightRadius={isModelScreen ? '$2' : 0}
      backgroundColor="$bg"
      overflow="hidden"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderSubdued"
    >
      <Stack
        $md={{
          width: '100%',
        }}
        $gtMd={{
          flex: isModelScreen ? 0 : 1,
          width: isModelScreen ? '100%' : undefined,
        }}
      >
        <Header
          title={getHeaderTitle(options, route.name)}
          // @ts-expect-error
          headerTintColor={headerTintColor}
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
          headerTransparent={headerTransparent}
          headerShadowVisible={false}
          headerBackground={headerBackground}
          headerStyle={headerStyle}
        />
      </Stack>
      {!!headerSearchBarOptions && (
        <Stack
          flex={0}
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
  );
}

export default memo(HeaderView);
