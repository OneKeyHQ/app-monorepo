import type { ReactNode } from 'react';

import { getFontSize } from 'tamagui';

import { hasNativeHeaderView } from '../Navigator/CommonConfig';

import HeaderBackButton from './HeaderBackButton';
import HeaderView from './HeaderView';

import type {
  IStackHeaderProps,
  IStackNavigationOptions,
} from '../ScreenProps';
import type { HeaderBackButtonProps } from '@react-navigation/elements';
import type { VariableVal } from '@tamagui/core';

export type IOnekeyStackHeaderProps = {
  navigation?: IStackHeaderProps['navigation'];
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
}: IOnekeyStackHeaderProps & {
  bgColor: VariableVal;
  titleColor: VariableVal;
}): IStackNavigationOptions {
  // It's only for iOS, see CommonConfig.hasNativeHeaderView
  if (hasNativeHeaderView) {
    const state = currentNavigation?.getState();
    const isCanGoBack = (state?.index ?? 0) > 0;

    return {
      headerStyle: {
        backgroundColor: bgColor as string,
      },
      headerTitleStyle: {
        fontSize: getFontSize('$headingLg'),
        color: titleColor as string,
      },
      headerShadowVisible: false,
      /* Although the default value of `headerTransparent` is `false` too, 
         we still cannot remove it here.
         because RNSSearchBar seems will read an incorrect default value.
      */
      headerTransparent: false,
      headerTitleAlign: 'left',
      headerLeft: (props: HeaderBackButtonProps): ReactNode => (
        <HeaderBackButton
          onPress={currentNavigation?.goBack}
          isModelScreen={isModelScreen}
          isRootScreen={isRootScreen}
          {...props}
          canGoBack={isCanGoBack}
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
    }: IStackHeaderProps) => (
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
