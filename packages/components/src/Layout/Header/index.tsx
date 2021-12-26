import React, { FC, ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import Box from '../../Box';
import { useSafeAreaInsets, useThemeValue } from '../../Provider/hooks';

type HeaderProps = {
  headerLeft: () => ReactNode;
  headerRight: () => ReactNode;
};

const Header: FC<HeaderProps> = ({ headerLeft, headerRight }) => {
  const insets = useSafeAreaInsets();

  const [bgColor, borderColor] = useThemeValue([
    'surface-subdued',
    'border-subdued',
  ]);

  return (
    <Box
      height={`${56 + insets.top}px`}
      pt={`${insets.top}px`}
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      px="2"
      bg={bgColor}
      borderColor={borderColor}
      borderWidth="0"
      borderBottomWidth={StyleSheet.hairlineWidth}
    >
      <Box flex="1" mr="2">
        {headerLeft()}
      </Box>
      <Box flex="1">{headerRight()}</Box>
    </Box>
  );
};

export default Header;
