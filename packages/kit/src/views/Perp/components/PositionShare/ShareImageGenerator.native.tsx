import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';

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
  referralQrCodeUrl?: string;
  referralDisplayText?: string;
  isReferralReady?: boolean;
}

async function fileUriToBase64(uri: string): Promise<string> {
  if (!RNFS) return '';
  const cleanUri = uri.replace(/^file:\/\//, '');
  const base64Content = await RNFS.readFile(cleanUri, 'base64');
  return `data:image/png;base64,${base64Content}`;
}

const IMAGES_READY_TIMEOUT_MS = 5000;

type IImagesReadyDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createImagesReadyDeferred(): IImagesReadyDeferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const ShareImageGenerator = forwardRef<
  IShareImageGeneratorRef,
  IShareImageGeneratorProps
>(
  (
    { data, config, referralQrCodeUrl, referralDisplayText, isReferralReady },
    ref,
  ) => {
    const viewShotRef = useRef<ViewShot>(null);
    // resolved by the renderer once every image and the lazily-encoded QR
    // have actually been drawn; the timeout below keeps capture from
    // hanging if any of them never signals
    const imagesReadyDeferredRef = useRef<IImagesReadyDeferred | null>(null);
    if (imagesReadyDeferredRef.current === null) {
      imagesReadyDeferredRef.current = createImagesReadyDeferred();
    }

    const handleImagesReady = useCallback(() => {
      imagesReadyDeferredRef.current?.resolve();
    }, []);

    const generate = useCallback(async (): Promise<string> => {
      const viewShot = viewShotRef.current;
      if (!viewShot) return '';

      try {
        await createTimeoutPromise({
          asyncFunc: () =>
            imagesReadyDeferredRef.current?.promise ?? Promise.resolve(),
          timeout: IMAGES_READY_TIMEOUT_MS,
          timeoutResult: undefined,
        });
        const fileUri = await viewShot.capture?.();
        if (!fileUri) return '';
        const base64 = await fileUriToBase64(fileUri);
        return base64;
      } catch (error) {
        if (platformEnv.isDev) {
          console.error('Failed to generate image:', error);
        }
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
            referralQrCodeUrl={referralQrCodeUrl}
            referralDisplayText={referralDisplayText}
            isReferralReady={isReferralReady}
            onImagesReady={handleImagesReady}
          />
        </ViewShot>
      </Stack>
    );
  },
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
