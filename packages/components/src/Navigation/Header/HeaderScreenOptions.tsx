import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HeaderButtonBack from './HeaderButtonBack';
import HeaderView from './HeaderView';

import type { StackHeaderProps } from '../StackNavigator';
import type { HeaderBackButtonProps } from '@react-navigation/elements';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export type OneKeyStackHeaderProps = {
  isModelScreen?: boolean;
  isRootScreen?: boolean;
  navigation?: StackHeaderProps['navigation'];
};

export function makeHeaderScreenOptions({
  navigation: iOSNavigation,
  isModelScreen = false,
  isRootScreen = false,
}: OneKeyStackHeaderProps): NativeStackNavigationOptions {
  if (platformEnv.isNativeIOS) {
    console.log('makeHeaderScreenOptions', {
      canGoBack: iOSNavigation,
      isModelScreen,
      isRootScreen,
    });

    return {
      headerLeft: (props: HeaderBackButtonProps) => (
        <HeaderButtonBack
          {...props}
          onPress={iOSNavigation?.goBack}
          canGoBack={iOSNavigation?.canGoBack?.()}
          isModelScreen={isModelScreen}
          isRootScreen={isRootScreen}
        />
      ),
    };
  }

  return {
    headerTitleAlign: 'left',
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
