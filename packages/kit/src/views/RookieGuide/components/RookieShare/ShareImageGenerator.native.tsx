import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import { CANVAS_CONFIG } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

import type { IRookieShareLocaleText } from './constants';

interface IShareImageGeneratorProps {
  data: IRookieShareData;
  localeText: IRookieShareLocaleText;
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
  IRookieShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data, localeText }, ref) => {
  const viewShotRef = useRef<ViewShot>(null);
  const imagesReadyDeferredRef = useRef<IImagesReadyDeferred | null>(null);
  const prevImageUrlRef = useRef<string | null>(null);
  const prevContentKeyRef = useRef<string | null>(null);
  const lastBase64Ref = useRef<string | null>(null);

  const contentKey = [
    data.imageUrl,
    data.title,
    data.subtitle,
    data.footerText,
    data.referralCode,
    data.referralUrl,
    localeText.footerText,
    localeText.referralLabel,
    localeText.downloadTitle,
    localeText.downloadSubtitle,
    localeText.qrCaption,
  ].join('\u0000');

  if (
    imagesReadyDeferredRef.current === null ||
    prevImageUrlRef.current !== data.imageUrl
  ) {
    imagesReadyDeferredRef.current = createImagesReadyDeferred();
    prevImageUrlRef.current = data.imageUrl;
  }

  if (prevContentKeyRef.current !== contentKey) {
    prevContentKeyRef.current = contentKey;
    lastBase64Ref.current = null;
  }

  const handleImagesReady = useCallback(() => {
    imagesReadyDeferredRef.current?.resolve();
  }, []);

  const generate = useCallback(async (): Promise<string> => {
    if (lastBase64Ref.current) return lastBase64Ref.current;

    const viewShot = viewShotRef.current;
    if (!viewShot) return '';

    try {
      await createTimeoutPromise({
        asyncFunc: () =>
          imagesReadyDeferredRef.current?.promise ?? Promise.resolve(),
        timeout: IMAGES_READY_TIMEOUT_MS,
        timeoutResult: undefined,
      });
      const dataUri = await viewShot.capture?.();
      if (!dataUri) return '';
      lastBase64Ref.current = dataUri;
      return dataUri;
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
        options={{ format: 'png', quality: 1.0, result: 'data-uri' }}
        style={{
          width: CANVAS_CONFIG.size,
          height: CANVAS_CONFIG.size,
        }}
      >
        <ShareContentRenderer
          data={data}
          localeText={localeText}
          onImagesReady={handleImagesReady}
        />
      </ViewShot>
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
