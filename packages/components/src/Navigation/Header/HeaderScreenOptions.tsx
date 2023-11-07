import type { ReactNode } from 'react';

import { getFontSize } from 'tamagui';

import { hasNativeHeaderView } from '../Navigator/CommonConfig.ts';

import HeaderBackButton from './HeaderBackButton';
import HeaderView from './HeaderView';

import type { StackHeaderProps, StackNavigationOptions } from '../ScreenProps';
import type { HeaderBackButtonProps } from '@react-navigation/elements';
import type { VariableVal } from '@tamagui/core';

export type OneKeyStackHeaderProps = {
  navigation?: StackHeaderProps['navigation'];
  isModelScreen?: boolean;
  isRootScreen?: boolean;
  isFlowModelScreen?: boolean;
  disableClose?: boolean;
};

export function makeHeaderScreenOptions({
  navigation: currentNavigation,
  isModelScreen = false,
  isRootScreen = false,
  bgColor,
  titleColor,
}: OneKeyStackHeaderProps & {
  bgColor: VariableVal;
  titleColor: VariableVal;
}): StackNavigationOptions {
  if (hasNativeHeaderView) {
    const state = currentNavigation?.getState();
    const isCanGoBack = (state?.index ?? 0) > 0;

    return {
      headerStyle: {
        backgroundColor: bgColor as string,
      },
      headerTransparent: false,
      headerTitleStyle: {
        fontSize: getFontSize('$headingLg'),
        color: titleColor as string,
      },
      headerLeft: (props: HeaderBackButtonProps): ReactNode => (
        <HeaderBackButton
          {...props}
          onPress={currentNavigation?.goBack}
          canGoBack={isCanGoBack}
          isModelScreen={isModelScreen}
          isRootScreen={isRootScreen}
        />
      ),
    };
  }

  return {
    headerTitleAlign: 'left',
    // @ts-expect-error
    header: ({
      back: headerBack,
      options,
      route,
      navigation,
    }: StackHeaderProps) => (
      <HeaderView
        back={headerBack}
        options={options}
        route={route}
        navigation={navigation}
        isModelScreen={isModelScreen}
        isRootScreen={isRootScreen}
      />
    ),
  };
}
