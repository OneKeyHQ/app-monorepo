import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Easing } from 'react-native';

import { Box, Divider, HStack, Icon, Typography } from '@onekeyhq/components';

const SwapFeatureText = () => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" pr="2">
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
  const ref = useRef({ container: 0, width: 0, inProcess: false });
  const animatedValue = useRef(new Animated.Value(0)).current;

  const startAnimation = useCallback(() => {
    const itemsWidth = ref.current.width * 3;
    const containerWidth = ref.current.container;
    if (
      !ref.current.inProcess &&
      itemsWidth &&
      containerWidth &&
      itemsWidth - containerWidth > 0
    ) {
      ref.current.inProcess = true;
      const toValue = -ref.current.width;
      animatedValue.setValue(0);
      Animated.timing(animatedValue, {
        toValue,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        ref.current.inProcess = false;
        startAnimation();
      });
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
            ref.current.container = width;
            startAnimation();
          }}
        >
          <Animated.View
            style={[{ transform: [{ translateX: animatedValue }] }]}
          >
            <HStack flexDirection="row">
              <Box
                onLayout={({
                  nativeEvent: {
                    layout: { width },
                  },
                }) => {
                  ref.current.width = width;
                  startAnimation();
                }}
              >
                <SwapFeatureText />
              </Box>
              <Box>
                <SwapFeatureText />
              </Box>
              <Box>
                <SwapFeatureText />
              </Box>
            </HStack>
          </Animated.View>
        </Box>
      </Box>
    </Box>
  );
};

export default SwapTexts;
