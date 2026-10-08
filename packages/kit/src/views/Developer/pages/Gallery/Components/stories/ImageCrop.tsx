import { useCallback, useState } from 'react';

import { Button, ImageCrop, SizableText, YStack } from '@onekeyhq/components';
import type { IPickerImage } from '@onekeyhq/components/src/composite/ImageCrop/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

function describeError(error: unknown) {
  if (error instanceof Error && 'code' in error) {
    return `${String(error.code)}: ${error.message}`;
  }
  return String(error);
}

function ImageCropDemo() {
  const [image, setImage] = useState<IPickerImage | undefined>();
  const [result, setResult] = useState('');

  const showResult = useCallback((data: IPickerImage) => {
    setImage(data);
    setResult(
      JSON.stringify({
        ...data,
        data: `${data.data?.length ?? 0} chars`,
      }),
    );
  }, []);

  const openPicker = useCallback(async () => {
    try {
      const data = await ImageCrop.openPicker({
        width: 500,
        height: 500,
      });
      console.log('cropImage:', data);
      showResult(data);
    } catch (error) {
      setResult(describeError(error));
    }
  }, [showResult]);

  // Crops the last result again, the path the NFT wallpaper flow uses.
  const openCropper = useCallback(async () => {
    const source = platformEnv.isNative ? image?.path : image?.data;
    if (!source) {
      return;
    }
    try {
      showResult(await ImageCrop.openCropImage(source, 300, 200));
    } catch (error) {
      setResult(describeError(error));
    }
  }, [image, showResult]);

  return (
    <YStack gap="$3">
      <Button onPress={openPicker}>open image crop picker</Button>
      <Button disabled={!image} onPress={openCropper}>
        crop last result to 300×200
      </Button>
      <SizableText size="$bodySm">{result}</SizableText>
    </YStack>
  );
}

const ImageCropGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="ImageCrop"
    elements={[
      {
        title: 'Default',
        element: <ImageCropDemo />,
      },
    ]}
  />
);

export default ImageCropGallery;
