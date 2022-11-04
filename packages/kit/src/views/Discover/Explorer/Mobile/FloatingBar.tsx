import { FC } from 'react';

import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Box, Icon, NetImage, Typography } from '@onekeyhq/components';

import { FLOATINGWINDOW_MIN } from '../explorerUtils';

const InfoBar: FC<{
  leftImgSrc?: string;
  text?: string;
}> = ({ leftImgSrc, text }) => (
  <Box
    bg="surface-subdued"
    px="12px"
    py="8px"
    h="48px"
    w="full"
    borderTopLeftRadius="12px"
    borderTopRightRadius="12px"
    flexDirection="row"
    alignItems="center"
    justifyContent="space-between"
  >
    <NetImage width="30px" height="30px" borderRadius="6px" src={leftImgSrc} />
    <Typography.Body2Strong
      color="text-default"
      flex={1}
      textAlign="left"
      mx="8px"
    >
      {text}
    </Typography.Body2Strong>
    <Icon name="ExpandOutline" />
  </Box>
);

const FloatingBar: FC<{
  leftImgSrc?: string;
  text?: string;
  expandAnim: Animated.SharedValue<number>;
}> = ({ leftImgSrc, text, expandAnim }) => (
  <Animated.View
    style={useAnimatedStyle(
      () => ({
        display: expandAnim.value === FLOATINGWINDOW_MIN ? 'flex' : 'none',
      }),
      [],
    )}
  >
    <InfoBar leftImgSrc={leftImgSrc} text={text} />
  </Animated.View>
);
FloatingBar.displayName = 'FloatingBar';
export default FloatingBar;
