import type { ReactNode } from 'react';

import { hasNativeHeaderView } from '../Navigator/CommonConfig.ts';

import HeaderButtonBack from './HeaderButtonBack';
import HeaderView from './HeaderView';

import type { StackHeaderProps, StackNavigationOptions } from '../ScreenProps';
import type { HeaderBackButtonProps } from '@react-navigation/elements';

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
}: OneKeyStackHeaderProps): StackNavigationOptions {
  if (hasNativeHeaderView) {
    const state = currentNavigation?.getState();
    const isCanGoBack = (state?.index ?? 0) > 0;

    return {
      headerTransparent: false,
      headerLeft: (props: HeaderBackButtonProps): ReactNode => (
        <HeaderButtonBack
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
    headerTransparent: false,
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
