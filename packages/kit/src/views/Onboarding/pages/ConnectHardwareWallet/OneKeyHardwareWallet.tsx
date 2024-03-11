import { useEffect } from 'react';

import { VideoView, useVideoPlayer } from '@expo/video';
import { Image, StyleSheet } from 'react-native';

import {
  Anchor,
  Heading,
  LinearGradient,
  Page,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function OneKeyHardwareWallet() {
  const source = require('@onekeyhq/kit/assets/onboarding/onekey-all-products.mp4');
  const player = useVideoPlayer(
    platformEnv.isNative ? Image.resolveAssetSource(source)?.uri : source,
  );

  // If the `@expo/video` had added the `autoPlay` property in the future, we can remove the entire `useEffect`
  useEffect(() => {
    player.isMuted = true;
    // On the web platform, we must add the setTimeout because of empty `mountedVideos`
    setTimeout(() => {
      player.play();
    });
  }, [player]);

  return (
    <Page>
      <Page.Header title="OneKey Hardware Wallet" />
      <Page.Body>
        <VideoView
          nativeControls={false}
          allowsFullscreen={false}
          showsTimecodes={false}
          contentPosition={undefined}
          requiresLinearPlayback={false}
          style={{
            width: '100%',
            height: '100%',
          }}
          player={player}
          contentFit="cover"
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
