/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsVerticalLayout, useThemeValue } from '@onekeyhq/components';

import Box from '../Box';

import HeaderBackButton from './HeaderBackButton';
import HeaderTitle from './HeaderTitle';

import type { HeaderTitleProps } from './HeaderTitle';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { StyleProp, ViewStyle } from 'react-native';

interface HeaderProps extends HeaderTitleProps {
  headerTitle?: () => ReactNode;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
  alwaysShowBackButton?: boolean;
  safeTop?: number;
  style?: StyleProp<ViewStyle>;
}

const defaultMobileHeight = 56;
const defaultDesktopHeight = 64;

const NavHeader: FC<HeaderProps & Partial<NativeStackHeaderProps>> = ({
  headerLeft,
  headerRight,
  headerTitle,
  safeTop,
  alwaysShowBackButton,
  style,
  navigation,
  options = {},
  route,
  back,
  ...headerTitleProps
}) => {
  const insets = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();
  const bgColor = useThemeValue('background-default');

  const height = isVertical ? defaultMobileHeight : defaultDesktopHeight;
  const hasLeft = Boolean(back || alwaysShowBackButton || headerLeft);
  const { title, titleString, subtitle, subtitleString } =
    options as unknown as HeaderTitleProps;
  const mergedHeaderTitleProps = {
    title,
    titleString,
    subtitle,
    subtitleString,
    ...headerTitleProps,
  };

  const titleComponent = headerTitle ? (
    headerTitle()
  ) : (
    <HeaderTitle inCenter={hasLeft} {...mergedHeaderTitleProps} />
  );

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          height,
          marginTop: safeTop ?? insets.top,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <View
        pointerEvents="box-none"
        style={[styles.content, { marginHorizontal: isVertical ? 16 : 32 }]}
      >
        <View
          pointerEvents="box-none"
          style={[styles.left, { marginStart: insets.left }]}
        >
          {(!!back || alwaysShowBackButton) && (
            <Box ml="-6px" mr="8px">
              <HeaderBackButton navigation={navigation} />
            </Box>
          )}
          {headerLeft?.()}
        </View>
        {titleComponent}
        <View
          pointerEvents="box-none"
          style={[styles.right, styles.expand, { marginEnd: insets.right }]}
        >
          {headerRight?.()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  right: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  expand: {
    flexGrow: 1,
    flexBasis: 0,
  },
});
export default NavHeader;
