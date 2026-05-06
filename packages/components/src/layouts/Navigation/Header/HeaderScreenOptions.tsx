import type { ReactNode } from 'react';

import { getFontSize } from '@onekeyhq/components/src/shared/tamagui';
import type { VariableVal } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { hasNativeHeaderView } from '../Navigator/CommonConfig';

import HeaderBackButton from './HeaderBackButton';
import HeaderView from './HeaderView';

import type {
  IStackHeaderProps,
  IStackNavigationOptions,
} from '../ScreenProps';
import type { HeaderBackButtonProps } from '@react-navigation/elements';

export type IOnekeyStackHeaderProps = {
  navigation?: IStackHeaderProps['navigation'];
  isModelScreen?: boolean;
  isRootScreen?: boolean;
  isFlowModelScreen?: boolean;
  isOnboardingScreen?: boolean;
};

export function makeHeaderScreenOptions({
  navigation: currentNavigation,
  isModelScreen = false,
  isRootScreen = false,
  isOnboardingScreen = false,
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
      // On iOS 26+ omit headerStyle so the patched react-native-screens
      // builds the appearance via configureWithDefaultBackground, letting
      // UIKit render the system Liquid Glass material on the navigation
      // bar. Passing backgroundColor would force the appearance opaque.
      ...(platformEnv.isNativeIOS26Plus
        ? {}
        : {
            headerStyle: {
              backgroundColor: bgColor as string,
            },
          }),
      headerTitleStyle: {
        fontSize: getFontSize('$headingLg'),
        color: titleColor as string,
      },
      headerShadowVisible: false,
      /* Although the default value of `headerTransparent` is `false` too,
         we still cannot remove it here.
         because RNSSearchBar seems will read an incorrect default value.

         On iOS 26+ we flip it to `true` so react-native-screens sets
         edgesForExtendedLayout = UIRectEdgeAll, letting the screen content
         render under the navigation bar. Without this the Liquid Glass
         material refracts the default (white) UINavigationController view
         background and the bar appears solid white.
      */
      headerTransparent: platformEnv.isNativeIOS26Plus ? true : false,
      headerTitleAlign: 'left',
      // TODO: don't override the headerLeft on iOS
      headerLeft: (props: HeaderBackButtonProps): ReactNode => (
        <HeaderBackButton
          onPress={currentNavigation?.goBack}
          isModelScreen={isModelScreen}
          isRootScreen={isRootScreen}
          isOnboardingScreen={isOnboardingScreen}
          {...props}
          canGoBack={isCanGoBack}
        />
      ),
    };
  }

  return {
    headerTitleAlign: 'left',
    header: ({ back: headerBack, options, route, navigation }: any) => (
      <HeaderView
        back={headerBack}
        options={options}
        route={route}
        navigation={navigation}
        isModelScreen={isModelScreen}
        isRootScreen={isRootScreen}
        isOnboardingScreen={isOnboardingScreen}
      />
    ),
  };
}
