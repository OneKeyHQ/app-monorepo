import { useCallback, useRef } from 'react';

import { Linking, StyleSheet } from 'react-native';

import {
  Heading,
  Icon,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  ThemeableStack,
  Video,
  VideoResizeMode,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import OneKeyAllProductsVideo from '@onekeyhq/kit/assets/onboarding/onekey-all-products.mp4';

export function OneKeyHardwareWallet() {
  const { bottom } = useSafeAreaInsets();

  const handleBuyButtonPress = useCallback(async () => {
    const url = 'https://shop.onekey.so/';

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      alert(`Don't know how to open this URL: ${url}`);
    }
  }, []);

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header title="OneKey Hardware Wallet" headerTransparent />
      <Page.Body>
        <Video
          usePoster
          posterSource={require('@onekeyhq/kit/assets/onboarding/onekey-all-products.png')}
          posterStyle={{
            resizeMode: VideoResizeMode.COVER,
          }}
          delayMs={550}
          style={{
            flex: 1,
          }}
          videoStyle={{
            width: '100%',
            height: '100%',
          }}
          resizeMode={VideoResizeMode.COVER}
          shouldPlay
          isLooping
          source={OneKeyAllProductsVideo}
        />
        <ThemeableStack fullscreen justifyContent="flex-end" zIndex={1}>
          <Stack p="$5" pt="$10">
            <LinearGradient
              colors={['transparent', '$blackA11']}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
              }}
              zIndex={-1}
            />
            <Stack
              alignItems="flex-start"
              pb={bottom}
              $gtMd={{
                maxWidth: '$100',
              }}
            >
              <Heading size="$heading4xl" color="$whiteA12">
                Your Secure Crypto Solution
              </Heading>
              <SizableText pt="$3" pb="$6" color="$whiteA11">
                OneKey Hardware Wallet, a secure and user-friendly solution for
                crypto management. It supports multiple cryptocurrencies and
                ensures robust encryption for safe transactions.
              </SizableText>
              <XStack
                $md={{
                  w: '100%',
                }}
                justifyContent="center"
                py="$4"
                px="$12"
                bg="$whiteA3"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$whiteA4"
                borderRadius="$3"
                hoverStyle={{
                  bg: '$whiteA4',
                }}
                pressStyle={{
                  bg: '$whiteA5',
                }}
                style={{
                  borderCurve: 'continuous',
                }}
                focusStyle={{
                  outlineColor: '$whiteA6',
                  outlineStyle: 'solid',
                  outlineOffset: 2,
                  outlineWidth: 2,
                }}
                userSelect="none"
                onPress={handleBuyButtonPress}
              >
                <Icon name="CartOutline" color="$whiteA12" />
                <SizableText color="$whiteA12" pl="$2.5" size="$bodyLgMedium">
                  Buy One
                </SizableText>
              </XStack>
            </Stack>
          </Stack>
        </ThemeableStack>
      </Page.Body>
    </Page>
  );
}

export default OneKeyHardwareWallet;
