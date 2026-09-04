import { useState } from 'react';

import {
  OneKeyImage,
  OneKeyImageLoadingStrategy,
  OneKeyImageVariant,
} from '@onekeyfe/react-native-image';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';

const DEFAULT_IMAGE_URL = 'https://uni.onekey-asset.com/static/chain/btc.png';

const imageStyle = {
  width: 80,
  height: 80,
  borderRadius: 40,
};

export function ImagePanel() {
  const [imageUrl, setImageUrl] = useState(DEFAULT_IMAGE_URL);
  const [status, setStatus] = useState('idle');

  const source = imageUrl ? { uri: imageUrl } : undefined;

  return (
    <YStack gap="$4">
      <Input
        value={imageUrl}
        onChangeText={setImageUrl}
        placeholder="Image URL"
      />
      <SizableText size="$bodyMd">Event: {status}</SizableText>
      <XStack gap="$4" flexWrap="wrap">
        <YStack gap="$2" alignItems="center">
          <OneKeyImage
            source={source}
            variant={OneKeyImageVariant.TOKEN}
            loadingStrategy={OneKeyImageLoadingStrategy.STATIC}
            style={imageStyle}
            onLoadStart={() => setStatus('loadStart')}
            onLoad={() => setStatus('load')}
            onDisplay={() => setStatus('display')}
            onError={({ error }) => setStatus(`error: ${error}`)}
            onLoadEnd={() => setStatus('loadEnd')}
          />
          <SizableText size="$bodySm">Native static</SizableText>
        </YStack>

        <YStack gap="$2" alignItems="center">
          <OneKeyImage
            source={source}
            variant={OneKeyImageVariant.AVATAR}
            loadingStrategy={OneKeyImageLoadingStrategy.SKELETON}
            style={imageStyle}
          />
          <SizableText size="$bodySm">Native skeleton</SizableText>
        </YStack>

        <YStack gap="$2" alignItems="center">
          <OneKeyImage
            variant={OneKeyImageVariant.GENERIC}
            style={imageStyle}
            fallback={
              <YStack
                width="100%"
                height="100%"
                alignItems="center"
                justifyContent="center"
                bg="$bgSubdued"
              >
                <SizableText size="$bodySm">Fallback</SizableText>
              </YStack>
            }
          />
          <SizableText size="$bodySm">React fallback</SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}
