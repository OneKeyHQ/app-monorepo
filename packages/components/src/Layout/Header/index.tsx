import React, { FC, ReactNode } from 'react';

import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';

import DesktopDragZoneBox from '../../DesktopDragZoneBox';
import HStack from '../../HStack';
import {
  useSafeAreaInsets,
  useTheme,
  useUserDevice,
} from '../../Provider/hooks';

type HeaderProps = {
  headerLeft: () => ReactNode;
  headerRight: () => ReactNode;
};

const DEFAULT_HEADER_VERTICAL = 57;
const DEFAULT_HEADER_HORIZONTAL = 65;

const Header: FC<HeaderProps> = ({ headerLeft, headerRight }) => {
  const insets = useSafeAreaInsets();
  const { size } = useUserDevice();
  const isHorizontal = ['LARGE', 'XLARGE'].includes(size);

  const headerHeight = isHorizontal
    ? DEFAULT_HEADER_HORIZONTAL
    : DEFAULT_HEADER_VERTICAL;

  const headerLeftNode = headerLeft?.();
  const { themeVariant } = useTheme();

  const PrimaryComponent = (
    <HStack
      height={`${headerHeight + insets.top}px`}
      pt={`${insets.top}px`}
      alignItems="center"
      justifyContent={isHorizontal ? 'flex-end' : 'space-between'}
      borderBottomColor="divider" // TODO: change the color from transparent to divider while scrolling up
      borderBottomWidth={StyleSheet.hairlineWidth}
      px={2}
    >
      {headerLeftNode ? (
        <HStack
          flex={isHorizontal ? undefined : 1}
          alignItems="center"
          h="full"
          pl={{ md: 2 }}
          pr={{ md: 4 }}
          flexShrink={0}
        >
          {headerLeftNode}
        </HStack>
      ) : null}

      {/* {isHorizontal && (
      <HStack alignItems="center" flex={1} pl={8}>
        <Typography.Heading>Home</Typography.Heading>
      </HStack>
    )} */}
      <HStack
        flex={isHorizontal ? undefined : 1}
        alignItems="center"
        justifyContent="flex-end"
        pr={{ md: 6 }}
      >
        {headerRight()}
      </HStack>
    </HStack>
  );

  return (
    <DesktopDragZoneBox>
      {Platform.OS === 'web' ? (
        PrimaryComponent
      ) : (
        <BlurView
          intensity={80} // TODO: change the intensity from 0 to 80 while scrolling up
          tint={
            // eslint-disable-next-line no-nested-ternary
            themeVariant === 'light'
              ? 'light'
              : themeVariant === 'dark'
              ? 'dark'
              : 'default'
          }
        >
          {PrimaryComponent}
        </BlurView>
      )}
    </DesktopDragZoneBox>
  );
};

export default Header;
