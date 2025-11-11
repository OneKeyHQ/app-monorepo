import { useEffect, useState } from 'react';

import { Image, Spinner, Stack } from '@onekeyhq/components';

import { getCanvasConfig } from './constants';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

interface IShareViewProps {
  data: IShareData;
  config: IShareConfig;
  scale?: number;
  generatorRef: React.RefObject<IShareImageGeneratorRef | null>;
}

export function ShareView({
  data,
  config,
  scale = 0.5,
  generatorRef,
}: IShareViewProps) {
  const CANVAS_CONFIG = getCanvasConfig(900);

  const displaySize = CANVAS_CONFIG.size * scale;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const generator = generatorRef.current;
          if (!generator) return;
          const base64 = await generator.generate();
          if (base64) {
            setPreviewImage(base64);
            setIsFirstLoad(false);
          }
        } catch (error) {
          setIsFirstLoad(false);
        }
      })();
    }, 50);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, config]);

  if (isFirstLoad && !previewImage) {
    return (
      <Stack
        width={displaySize}
        height={displaySize}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$bgSubdued"
        borderRadius="$3"
      >
        <Spinner size="large" />
      </Stack>
    );
  }

  return (
    <Stack
      width={displaySize}
      height={displaySize}
      borderRadius="$3"
      overflow="hidden"
      borderWidth={1}
      borderColor="$borderSubdued"
    >
      {previewImage ? (
        <Image
          source={{ uri: previewImage }}
          width={displaySize}
          height={displaySize}
          resizeMode="contain"
        />
      ) : null}
    </Stack>
  );
}
