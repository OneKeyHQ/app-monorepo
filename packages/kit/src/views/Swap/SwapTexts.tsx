import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import { Box, Divider, HStack, Icon, Typography } from '@onekeyhq/components';

const SwapFeatureText = () => {
  const intl = useIntl();
  return (
    <Box flexDirection="row">
      <Box flexDirection="row">
        <Icon size={16} name="RectangleGroupMini" />
        <Box w="1" />
        <Typography.CaptionStrong color="text-subdued">
          {intl.formatMessage({ id: 'form__cross_chain_swap' })}
        </Typography.CaptionStrong>
      </Box>
      <Box w="2" />
      <Box flexDirection="row">
        <Icon size={16} name="ShieldCheckMini" />
        <Box w="1" />
        <Typography.CaptionStrong color="text-subdued">
          {intl.formatMessage({
            id: 'form__exact_amount_allowance',
          })}
        </Typography.CaptionStrong>
      </Box>
      <Box w="2" />
      <Box flexDirection="row">
        <Icon size={16} name="Square3Stack3Dmini" />
        <Box w="1" />
        <Typography.CaptionStrong color="text-subdued">
          {intl.formatMessage({
            id: 'form__anti_sandwich_attack',
          })}
        </Typography.CaptionStrong>
      </Box>
    </Box>
  );
};

const SwapTexts = () => {
  const ref = useRef({ outer: 0, inner: [] as number[] });
  const animatedValue = useRef(new Animated.Value(0)).current;

  const renderLayout = useCallback(() => {
    let innersWidth = ref.current.inner.reduce((a, b) => a + b, 0);
    innersWidth += (ref.current.inner.length - 1) * 16;
    const outerWidth = ref.current.outer;
    if (innersWidth && outerWidth && innersWidth - outerWidth) {
      const toValue = outerWidth - innersWidth;
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue,
            duration: 30000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 30000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      animatedValue.stopAnimation();
    }
  }, [animatedValue]);

  return (
    <Box pb="4">
      <Box px="4">
        <Divider />
      </Box>
      <Box mt="4" px="4">
        <Box
          w="full"
          overflow="hidden"
          onLayout={({
            nativeEvent: {
              layout: { width },
            },
          }) => {
            ref.current.outer = width;
            renderLayout();
          }}
        >
          <Animated.View
            style={[{ transform: [{ translateX: animatedValue }] }]}
          >
            <HStack flexDirection="row" space="2">
              {[1, 2, 3].map((item, i) => (
                <Box
                  onLayout={({
                    nativeEvent: {
                      layout: { width },
                    },
                  }) => {
                    ref.current.inner[i] = width;
                  }}
                >
                  <SwapFeatureText />
                </Box>
              ))}
            </HStack>
          </Animated.View>
        </Box>
      </Box>
    </Box>
  );
};

export default SwapTexts;
