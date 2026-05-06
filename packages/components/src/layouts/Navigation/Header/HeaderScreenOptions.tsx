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

    // Liquid Glass material is enabled for both the topmost screen of
    // a root tab and pushed children inside that tab — the glass header
    // is the iOS 26 system look users expect everywhere in the chrome.
    // Modal/onboarding screens are excluded (isRootScreen=false).
    const useLiquidGlassHeader =
      platformEnv.isNativeIOS26Plus && isRootScreen;
    // Only the true top of a tab extends content under the bar so the
    // glass refracts real content. Pushed children keep
    // edgesForExtendedLayout = UIRectEdgeAll - UIRectEdgeTop so pages
    // with custom top layouts (e.g. the Perps ETHUSDC stat row) don't
    // bleed into the navigation bar area; their glass refracts the
    // navigation controller's view background instead.
    const useTransparentHeader = useLiquidGlassHeader && !isCanGoBack;

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
      headerTransparent: useTransparentHeader ? true : false,
      headerTitleAlign: 'left',
      // iOS 26+ uses native-stack's built-in bar button rendering so
      // UIKit draws each button in its proper iOS 26 circular glass
      // container.
      //   - Pushed screens (canGoBack): omit headerLeft so the system
      //     back button renders. Setting headerBackButtonDisplayMode to
      //     'minimal' hides the previous-screen back-title; the long-press
      //     navigation history menu still works because that's a system
      //     UIBarButtonItem feature controlled by
      //     headerBackButtonMenuEnabled (default true).
      //   - Modal/onboarding close (no canGoBack): use
      //     unstable_headerLeftItems with the `xmark` SF Symbol. UIKit has
      //     no built-in modal close primitive, so we emit a button item
      //     and own its onPress.
      //   - Root tab with no buttons: nothing to wire.
      //
      // iOS <26 keeps the OneKey-drawn HeaderBackButton path unchanged.
      ...(platformEnv.isNativeIOS26Plus
        ? isCanGoBack
          ? {
              headerBackButtonDisplayMode: 'minimal' as const,
            }
          : (isModelScreen || isOnboardingScreen) && !isRootScreen
          ? {
              unstable_headerLeftItems: () => [
                {
                  type: 'button' as const,
                  label: 'Close',
                  icon: { type: 'sfSymbol' as const, name: 'xmark' },
                  onPress: () => currentNavigation?.goBack?.(),
                },
              ],
            }
          : {}
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
