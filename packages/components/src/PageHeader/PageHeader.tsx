/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
import { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsVerticalLayout } from '../Provider/hooks';

import HeaderBackButton from './HeaderBackButton';
import HeaderTitle from './HeaderTitle';

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
  headerTitle?: () => ReactNode;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
}

const defaultMobileHeight = 56;
const defaultDesktopHeight = 64;

export default function PageHeader({
  title,
  subtitle,
  headerLeft,
  headerRight,
  headerTitle,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();

  const height = isVertical ? defaultMobileHeight : defaultDesktopHeight;

  const leftButton = headerLeft ? headerLeft() : <HeaderBackButton />;

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
        paddingTop: insets.top,
      }}
    >
      <View pointerEvents="box-none" style={styles.content}>
        <View
          pointerEvents="box-none"
          style={[styles.left, { marginStart: insets.left }]}
        >
          {leftButton}
        </View>
        <View pointerEvents="box-none" style={styles.title}>
          {titleComponent}
        </View>
        <View
          pointerEvents="box-none"
          style={[styles.right, styles.expand, { marginEnd: insets.right }]}
        >
          {headerRight?.()}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  title: {
    marginHorizontal: 16,
    justifyContent: 'center',
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
