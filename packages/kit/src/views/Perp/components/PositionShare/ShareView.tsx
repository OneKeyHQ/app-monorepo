import { useEffect, useRef, useState } from 'react';

import { Image, Spinner, Stack } from '@onekeyhq/components';

import { getCanvasConfig } from './constants';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
  IShareReferralInfo,
} from './types';

const CANVAS_CONFIG = getCanvasConfig(900);

interface IShareViewProps extends IShareReferralInfo {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
  isReferralReady?: boolean;
  generatorRef: React.RefObject<IShareImageGeneratorRef | null>;
}

export function ShareView({
  data,
  config,
  scale = 0.5,
  referralQrCodeUrl,
  referralDisplayText,
  isReferralReady,
  generatorRef,
}: IShareViewProps) {
  const displaySize = CANVAS_CONFIG.size * scale;
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
  }, [
    data,
    config,
    referralQrCodeUrl,
    referralDisplayText,
    isReferralReady,
    generatorRef,
  ]);

  return (
    <Stack
      width={displaySize}
      height={displaySize}
      borderRadius="$3"
      overflow="hidden"
      borderWidth={1}
      borderColor="$borderSubdued"
      position="relative"
    >
      {previewImage ? (
        <Image
          source={{ uri: previewImage }}
          width={displaySize}
          height={displaySize}
          resizeMode="contain"
        />
      ) : null}
      {isGenerating && !previewImage ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
          backgroundColor="$bgSubdued"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}
