import { useEffect, useRef, useState } from 'react';

import { Image as RNImage, StyleSheet } from 'react-native';

import { Image, Spinner, Stack } from '@onekeyhq/components';

import { SHARE_CARD_CONFIG } from './constants';
import { ShareImageGenerator } from './ShareImageGenerator';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from './types';

interface IShareViewProps {
  data: IReceiveShareData;
  generatorRef: React.RefObject<IReceiveShareImageGeneratorRef | null>;
  // cap on the preview height; the box shrinks proportionally (contain-fit)
  // so small viewports (ext popup) never need to scroll
  maxHeight?: number;
}

export function ShareView({ data, generatorRef, maxHeight }: IShareViewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  // the generated card height is content-dependent (long addresses wrap),
  // so size the preview box from the actual image to avoid gray side bars
  const [aspectRatio, setAspectRatio] = useState(
    SHARE_CARD_CONFIG.width / SHARE_CARD_CONFIG.minHeight,
  );
  const generationIdRef = useRef(0);

  useEffect(() => {
    if (!previewImage) return;
    RNImage.getSize(
      previewImage,
      (imgWidth, imgHeight) => {
        if (imgWidth > 0 && imgHeight > 0) {
          setAspectRatio(imgWidth / imgHeight);
        }
      },
      () => {},
    );
  }, [previewImage]);

  useEffect(() => {
    generationIdRef.current += 1;
    const currentGenerationId = generationIdRef.current;
    setIsGenerating(true);
    setPreviewImage(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const generator = generatorRef.current;
          if (!generator) {
            setIsGenerating(false);
            return;
          }
          const base64 = await generator.generate();
          // Only update if this is still the current generation
          if (currentGenerationId === generationIdRef.current && base64) {
            setPreviewImage(base64);
          }
        } finally {
          if (currentGenerationId === generationIdRef.current) {
            setIsGenerating(false);
          }
        }
      })();
    }, 50);

    return () => clearTimeout(timer);
  }, [data, generatorRef]);

  return (
    <Stack
      width="100%"
      // width × (1/aspectRatio) ≤ maxHeight, so the box always fits the
      // viewport height without scrolling
      maxWidth={maxHeight ? maxHeight * aspectRatio : undefined}
      alignSelf="center"
      aspectRatio={aspectRatio}
      borderRadius={14}
      borderCurve="continuous"
      // dialog-only affordance to outline the image area; the exported
      // image itself has no border
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      overflow="hidden"
      backgroundColor="$bgSubdued"
      alignItems="center"
      justifyContent="center"
    >
      {isGenerating || !previewImage ? (
        <Spinner size="large" />
      ) : (
        <Image
          width="100%"
          height="100%"
          source={{ uri: previewImage }}
          resizeMode="contain"
        />
      )}
      <ShareImageGenerator ref={generatorRef} data={data} />
    </Stack>
  );
}
