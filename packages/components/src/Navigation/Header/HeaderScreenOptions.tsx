import platformEnv from '@onekeyhq/shared/src/platformEnv';

import HeaderButtonBack from './HeaderButtonBack';
import HeaderView from './HeaderView';

import type { StackHeaderProps } from '../StackNavigator.native';
import type { HeaderBackButtonProps } from '@react-navigation/elements';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { hasNativeModal } from '../Navigator/CommonConfig.ts';

export type OneKeyStackHeaderProps = {
  navigation?: StackHeaderProps['navigation'];
  isModelScreen?: boolean;
  isRootScreen?: boolean;
  isFlowModelScreen?: boolean;
};

export function makeHeaderScreenOptions({
  navigation: currentNavigation,
  isModelScreen = false,
  isRootScreen = false,
  isFlowModelScreen = false,
}: OneKeyStackHeaderProps): NativeStackNavigationOptions {
  if (hasNativeModal) {
    const state = currentNavigation?.getState();
    const isCanGoBack = (state?.index ?? 0) > 0;

    return {
      headerTransparent: false,
      headerLeft: (props: HeaderBackButtonProps) => (
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
        isFlowModelScreen={isFlowModelScreen}
      />
    ),
  };
}
