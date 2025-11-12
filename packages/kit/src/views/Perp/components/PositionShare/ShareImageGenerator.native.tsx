import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';

import { CANVAS_CONFIG } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

interface IShareImageGeneratorProps {
  data: IShareData;
  config: IShareConfig;
}

async function fileUriToBase64(uri: string): Promise<string> {
  if (!RNFS) return '';
  const cleanUri = uri.replace(/^file:\/\//, '');
  const base64Content = await RNFS.readFile(cleanUri, 'base64');
  return `data:image/png;base64,${base64Content}`;
}

export const ShareImageGenerator = forwardRef<
  IShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data, config }, ref) => {
  const viewShotRef = useRef<ViewShot>(null);
  const imagesReadyPromiseRef = useRef<{
    resolve: () => void;
    reject: () => void;
  } | null>(null);

  const handleImagesReady = useCallback(() => {
    if (imagesReadyPromiseRef.current) {
      imagesReadyPromiseRef.current.resolve();
      imagesReadyPromiseRef.current = null;
    }
  }, []);

  const generate = useCallback(async (): Promise<string> => {
    const viewShot = viewShotRef.current;
    if (!viewShot) return '';

    try {
      const waitPromise = new Promise<void>((resolve, reject) => {
        imagesReadyPromiseRef.current = { resolve, reject };
        setTimeout(() => {
          if (imagesReadyPromiseRef.current) {
            imagesReadyPromiseRef.current.reject();
            imagesReadyPromiseRef.current = null;
          }
        }, 5000);
      });

      await waitPromise;

      const fileUri = await viewShot.capture?.();
      if (!fileUri) return '';
      const base64 = await fileUriToBase64(fileUri);
      return base64;
    } catch {
      return '';
    }
  }, []);

  useImperativeHandle(ref, () => ({ generate }));

  return (
    <Stack position="absolute" left={-9999} top={-9999} opacity={0}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1.0 }}
        style={{ width: CANVAS_CONFIG.size, height: CANVAS_CONFIG.size }}
      >
        <ShareContentRenderer
          data={data}
          config={config}
          onImagesReady={handleImagesReady}
        />
      </ViewShot>
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
