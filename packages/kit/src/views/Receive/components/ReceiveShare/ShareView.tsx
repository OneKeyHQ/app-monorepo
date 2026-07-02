import { useEffect, useRef, useState } from 'react';

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
}

export function ShareView({ data, generatorRef }: IShareViewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const generationIdRef = useRef(0);

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
      aspectRatio={SHARE_CARD_CONFIG.width / SHARE_CARD_CONFIG.minHeight}
      borderRadius="$4"
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
