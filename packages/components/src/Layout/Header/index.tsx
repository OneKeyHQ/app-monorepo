import React, { FC, ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import HStack from '../../HStack';
import {
  useSafeAreaInsets,
  useThemeValue,
  useUserDevice,
} from '../../Provider/hooks';
import Typography from '../../Typography';

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

  const [bgColor, borderColor] = useThemeValue([
    'surface-subdued',
    'border-subdued',
  ]);

  return (
    <HStack
      height={`${headerHeight + insets.top}px`}
      pt={`${insets.top}px`}
      alignItems="center"
      justifyContent="space-between"
      px={2}
      bg={bgColor}
      borderColor={borderColor}
      borderWidth="0"
      borderBottomWidth={StyleSheet.hairlineWidth}
      zIndex={999}
    >
      <HStack
        alignItems="center"
        h="full"
        borderRightColor="border-subdued"
        borderRightWidth={{ md: 1 }}
        pl={{ md: 2 }}
        pr={{ md: 4 }}
        w={{ md: '248px' }}
        flexShrink={0}
      >
        {headerLeft()}
      </HStack>
      {isHorizontal && (
        <HStack alignItems="center" flex={1} pl={8}>
          <Typography.Heading>Home</Typography.Heading>
        </HStack>
      )}
      <HStack alignItems="center" pr={{ md: 6 }}>
        {headerRight()}
      </HStack>
    </HStack>
  );
};

export default Header;
