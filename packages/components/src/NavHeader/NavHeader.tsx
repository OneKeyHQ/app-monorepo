/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
import { FC, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsVerticalLayout } from '../Provider/hooks';

import HeaderBackButton from './HeaderBackButton';
import HeaderTitle from './HeaderTitle';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  headerTitle?: () => ReactNode;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
  enableBackButton?: boolean;
  safeTop?: number;
}

const defaultMobileHeight = 56;
const defaultDesktopHeight = 64;

const NavHeader: FC<HeaderProps> = ({
  title,
  subtitle,
  headerLeft,
  headerRight,
  headerTitle,
  safeTop,
  enableBackButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();

  const height = isVertical ? defaultMobileHeight : defaultDesktopHeight;

  const titleComponent = headerTitle ? (
    headerTitle()
  ) : title ? (
    <HeaderTitle title={title} subtitle={subtitle} />
  ) : null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        height,
        paddingTop: safeTop ?? insets.top,
      }}
    >
      <View
        pointerEvents="box-none"
        style={[styles.content, { marginHorizontal: isVertical ? 16 : 32 }]}
      >
        <View
          pointerEvents="box-none"
          style={[styles.left, { marginStart: insets.left }]}
        >
          {enableBackButton && <HeaderBackButton />}
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
    alignItems: 'stretch',
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
