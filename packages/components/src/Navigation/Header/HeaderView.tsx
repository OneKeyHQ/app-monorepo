import { useCallback } from 'react';

import { Header, getHeaderTitle } from '@react-navigation/elements';
import { StyleSheet } from 'react-native';
import { Input } from 'tamagui';

import { Stack } from '../../index';

import HeaderButtonBack from './HeaderButtonBack';

import type { StackHeaderProps } from '../StackNavigator.native';
import type { OneKeyStackHeaderProps } from './HeaderScreenOptions';
import type { HeaderBackButtonProps } from '@react-navigation/elements/src/types';

export default function HeaderView({
  back: headerBack,
  options,
  route,
  navigation,
  isModelScreen = false,
  isRootScreen = false,
}: StackHeaderProps & OneKeyStackHeaderProps) {
  const {
    headerTintColor,
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerStyle,
    headerTransparent,
    headerBackground,
    headerSearchBarOptions,
  } = options;

  const canGoBack = headerBack !== undefined;

  const onBackCallback = useCallback(() => {
    if (canGoBack) {
      navigation?.goBack?.();
    } else {
      navigation?.getParent()?.goBack?.();
    }
  }, [canGoBack, navigation]);

  const headerLeftView = useCallback(
    (props: HeaderBackButtonProps) => (
      <HeaderButtonBack
        {...props}
        canGoBack={canGoBack}
        onPress={onBackCallback}
        isRootScreen={isRootScreen}
        isModelScreen={isModelScreen}
      />
    ),
    [canGoBack, isModelScreen, isRootScreen, onBackCallback],
  );

  return (
    <Stack
      flex={1}
      px="$5"
      $xs={{
        flexDirection: 'column',
      }}
      $lg={{
        flexDirection: 'row',
      }}
      backgroundColor="$bg"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$borderSubdued"
      // shadowColor="$borderSubdued"
    >
      <Stack flex={1}>
        <Header
          title={getHeaderTitle(options, route.name)}
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
          $xs={{
            pb: '$4',
            width: '100%',
          }}
          $lg={{
            pl: '$5',
            py: '$3.5',
            width: '$60',
          }}
        >
          {/* demo */}
          <Input
            $xs={{
              height: '$9',
            }}
            $lg={{
              height: '$8',
            }}
            borderWidth={1}
            placeholder={headerSearchBarOptions?.placeholder}
            onChange={headerSearchBarOptions?.onChangeText}
          />
        </Stack>
      )}
    </Stack>
  );
}
