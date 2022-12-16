import React, { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import { Box, Divider, HStack, Icon, Typography } from '@onekeyhq/components';

const SwapTexts = () => {
  const intl = useIntl();
  const ref = useRef({ outer: 0, inner: [] as number[] });
  const animatedValue = useRef(new Animated.Value(0)).current;
  const data = useMemo(
    () => [
      {
        icon: 'RectangleGroupMini' as const,
        text: intl.formatMessage({ id: 'form__cross_chain_swap' }),
      },
      {
        icon: 'ShieldCheckMini' as const,
        text: intl.formatMessage({ id: 'form__exact_amount_allowance' }),
      },
      {
        icon: 'Square3Stack3Dmini' as const,
        text: intl.formatMessage({ id: 'form__anti_sandwich_attack' }),
      },
    ],
    [intl],
  );

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
    <Box>
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
            <HStack flexDirection="row" space="4">
              {data.map((item, i) => (
                <Box
                  key={item.icon}
                  flexDirection="row"
                  onLayout={({
                    nativeEvent: {
                      layout: { width },
                    },
                  }) => {
                    ref.current.inner[i] = width;
                  }}
                >
                  <Icon size={16} name={item.icon} />
                  <Box w="1" />
                  <Typography.CaptionStrong color="text-subdued">
                    {item.text}
                  </Typography.CaptionStrong>
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
