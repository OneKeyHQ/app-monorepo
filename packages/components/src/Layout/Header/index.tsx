import React, { FC, ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import Box from '../../Box';
import {
  useSafeAreaInsets,
  useThemeValue,
  useUserDevice,
} from '../../Provider/hooks';

type HeaderProps = {
  headerLeft: () => ReactNode;
  headerRight: () => ReactNode;
};

const DEFAULT_HEADER_VERTICAL = 56;
const DEFAULT_HEADER_HORIZONTAL = 64;

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
    <Box
      height={`${headerHeight + insets.top}px`}
      pt={`${insets.top}px`}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      px="1"
      bg={bgColor}
      borderColor={borderColor}
      borderWidth="0"
      borderBottomWidth={StyleSheet.hairlineWidth}
    >
      <Box
        flex="1"
        flexDirection="row"
        justifyContent="flex-start"
        alignItems="center"
      >
        {headerLeft()}
      </Box>
      <Box
        flex="1"
        flexDirection="row"
        justifyContent="flex-end"
        alignItems="center"
      >
        {headerRight()}
      </Box>
    </Box>
  );
};

export default Header;
