import { useState } from 'react';

import { Image as NativeImage } from 'react-native';

import { Image, Input, YStack } from '@onekeyhq/components';

export function ImagePanel() {
  const [imageUrl, setImage] = useState<string>('');
  return (
    <YStack gap="$4">
      <Input value={imageUrl} onChangeText={setImage} placeholder="Image URL" />
      <Image source={{ uri: imageUrl }} size="$10" />
      <NativeImage
        source={{ uri: imageUrl }}
        style={{ width: 100, height: 100 }}
      />
    </YStack>
  );
}
