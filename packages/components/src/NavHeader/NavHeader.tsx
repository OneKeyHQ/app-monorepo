/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-nested-ternary */
import type { FC, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Box from '../Box';

import HeaderBackButton from './HeaderBackButton';
import HeaderTitle from './HeaderTitle';

import type { HeaderTitleProps } from './HeaderTitle';

interface HeaderProps extends HeaderTitleProps {
  headerTitle?: () => ReactNode;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
  enableBackButton?: boolean;
  safeTop?: number;
}

const defaultMobileHeight = 56;
const defaultDesktopHeight = 64;

const NavHeader: FC<HeaderProps> = ({
  headerLeft,
  headerRight,
  headerTitle,
  safeTop,
  enableBackButton = true,
  ...headerTitleProps
}) => {
  const insets = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();

  const height = isVertical ? defaultMobileHeight : defaultDesktopHeight;

  const titleComponent = headerTitle ? (
    headerTitle()
  ) : (
    <HeaderTitle {...headerTitleProps} />
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        height,
        marginTop: safeTop ?? insets.top,
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
          {enableBackButton && (
            <Box ml="-6px" mr="8px">
              <HeaderBackButton />
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
