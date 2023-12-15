import { useRef } from 'react';

import { ResizeMode, Video } from 'expo-av';
import { StyleSheet } from 'react-native';

import {
  Anchor,
  Button,
  Heading,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  getTokenValue,
} from '@onekeyhq/components';

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
          source={{
            uri: 'https://asset.onekey-asset.com/portal/5d73d49b1a8c5c0dee9f3df46afb3e5a70e27614/shop/hero/shop-hero-animation-compressed-v2.mp4',
          }}
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
              colors={['transparent', 'rgba(0,0,0,.85)']}
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
              <SizableText pt="$3" pb="$6" color="$whiteA12">
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
                bg="$whiteA2"
                color="$whiteA12"
                size="$bodyLgMedium"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$whiteA3"
                borderRadius="$3"
                hoverStyle={{
                  bg: '$whiteA3',
                }}
                pressStyle={{
                  bg: '$whiteA4',
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
