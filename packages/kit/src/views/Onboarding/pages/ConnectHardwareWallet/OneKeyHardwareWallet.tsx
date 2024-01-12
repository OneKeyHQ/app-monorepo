import { useRef } from 'react';

import { ResizeMode, Video } from 'expo-av';
import { StyleSheet } from 'react-native';

import {
  Anchor,
  Heading,
  LinearGradient,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import OneKeyAllProductsVideo from '@onekeyhq/kit/src/assets/onboarding/onekey-all-products.mp4';

export function OneKeyHardwareWallet() {
  const video = useRef(null);

  return (
    <Page>
      <Page.Header title="OneKey Hardware Wallet" />
      <Page.Body>
        <Video
          style={{
            flex: 1,
          }}
          videoStyle={{
            width: '100%',
            height: '100%',
          }}
          ref={video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          source={OneKeyAllProductsVideo}
        />
        <Stack
          position="absolute"
          left={0}
          top={0}
          right={0}
          bottom={0}
          zIndex={1}
          justifyContent="flex-end"
        >
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
            <Stack maxWidth="$100" alignItems="flex-start">
              <Heading size="$heading4xl" color="$whiteA12">
                Your Secure Crypto Solution
              </Heading>
              <SizableText pt="$3" pb="$6" color="$whiteA11">
                OneKey Hardware Wallet, a secure and user-friendly solution for
                crypto management. It supports multiple cryptocurrencies and
                ensures robust encryption for safe transactions.
              </SizableText>
              <Anchor
                display="flex"
                href="https://shop.onekey.so/"
                target="_blank"
                textDecorationLine="none"
                py="$2"
                px="$5"
                bg="$whiteA3"
                color="$whiteA12"
                size="$bodyLgMedium"
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
              >
                Buy One
              </Anchor>
            </Stack>
          </Stack>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default OneKeyHardwareWallet;
