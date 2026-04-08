import { useEffect, useRef, useState } from 'react';

import { Image, Spinner, Stack } from '@onekeyhq/components';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import { ShareImageGenerator } from './ShareImageGenerator';

interface IShareViewProps {
  data: IRookieShareData;
  generatorRef: React.RefObject<IRookieShareImageGeneratorRef | null>;
}

export function ShareView({ data, generatorRef }: IShareViewProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const generationIdRef = useRef(0);

  useEffect(() => {
    generationIdRef.current += 1;
    const currentGenerationId = generationIdRef.current;
    setIsGenerating(true);

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
      aspectRatio={1}
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
