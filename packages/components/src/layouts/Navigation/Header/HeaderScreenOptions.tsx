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

    // Liquid Glass header is enabled only on root tabs. Modal and
    // onboarding screens are presented over a parent VC; extending the
    // child content under a translucent navigation bar would let the
    // parent's chrome bleed through. They keep the existing opaque themed
    // header on iOS 26+.
    const useLiquidGlassHeader =
      platformEnv.isNativeIOS26Plus && isRootScreen;

    return {
      // Omit headerStyle when Liquid Glass is active so the patched
      // react-native-screens calls configureWithDefaultBackground and lets
      // UIKit render the system glass material. Passing backgroundColor
      // would force the appearance opaque and suppress glass.
      ...(useLiquidGlassHeader
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

         On iOS 26+ root tabs flip it to `true` so react-native-screens
         sets edgesForExtendedLayout = UIRectEdgeAll, letting the tab
         content render under the navigation bar so the Liquid Glass
         material refracts it. Modal/onboarding screens keep `false` —
         their parent screen still draws underneath them, and an extended
         layout would show that parent through the modal chrome.
      */
      headerTransparent: useLiquidGlassHeader ? true : false,
      headerTitleAlign: 'left',
      // On iOS 26+ for pushed screens (canGoBack), defer to the system
      // back button rendering. UIKit draws the chevron in a circular
      // glass container that's already correctly sized and centered —
      // bypassing our custom HeaderBackButton avoids the pill-shape and
      // alignment quirks introduced by stuffing a small custom view into
      // the new bar button slot. Modal/onboarding close (no canGoBack)
      // keeps the custom X because the system has no equivalent.
      ...(platformEnv.isNativeIOS26Plus && isCanGoBack
        ? { headerBackTitle: '' }
        : {
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
          }),
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
