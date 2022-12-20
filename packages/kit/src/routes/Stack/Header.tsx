/* eslint-disable no-nested-ternary */
import type { ComponentProps, FC, ReactNode } from 'react';

import {
  Header as NavigationHeader,
  HeaderBackButton as NavigationHeaderBackButton,
  getHeaderTitle,
} from '@react-navigation/elements';

import { useSafeAreaInsets } from '@onekeyhq/components';

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

const Header: FC<ComponentProps<typeof NavigationHeader>> = (props) => {
  const { top } = useSafeAreaInsets();
  return <NavigationHeader {...props} headerStatusBarHeight={top} />;
};

const renderCustomSubStackHeader = ({
  options,
  navigation,
  route,
}: NativeStackHeaderProps): ReactNode => {
  const canGoBack = navigation?.canGoBack?.();
  const {
    headerTintColor,
    headerLeft,
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerTitleStyle,
    headerStyle,
    headerShadowVisible,
    headerTransparent,
    headerBackTitle,
  } = options;

  return (
    <Header
      title={getHeaderTitle(options, route.name)}
      headerTintColor={headerTintColor}
      headerLeft={
        typeof headerLeft === 'function'
          ? ({ tintColor }) =>
              headerLeft({
                tintColor,
                canGoBack,
                label: headerBackTitle,
              })
          : headerLeft === undefined && canGoBack
          ? ({ tintColor }) => (
              <NavigationHeaderBackButton
                tintColor={tintColor}
                // eslint-disable-next-line @typescript-eslint/unbound-method
                onPress={navigation.goBack}
                canGoBack={canGoBack}
              />
            )
          : headerLeft
      }
      headerRight={
        typeof headerRight === 'function'
          ? ({ tintColor }) => headerRight({ tintColor })
          : headerRight
      }
      headerTitle={
        typeof headerTitle === 'function'
          ? ({ children, tintColor }) => headerTitle({ children, tintColor })
          : headerTitle
      }
      headerTitleAlign={headerTitleAlign}
      headerTitleStyle={headerTitleStyle}
      headerStyle={[
        headerTransparent
          ? {
              position: 'absolute',
              backgroundColor: 'transparent',
            }
          : null,
        headerStyle,
        headerShadowVisible === false
          ? { shadowOpacity: 0, borderBottomWidth: 0 }
          : null,
      ]}
    />
  );
};

export default renderCustomSubStackHeader;
