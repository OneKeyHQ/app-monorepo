import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { createTimeoutPromise } from '@onekeyhq/shared/src/utils/promiseUtils';

import { SHARE_CARD_CONFIG } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from './types';

interface IShareImageGeneratorProps {
  data: IReceiveShareData;
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

// memoized: it stays mounted offscreen in ReceiveToken, which re-renders
// often — skip reconciling the ViewShot subtree unless `data` changes
export const ShareImageGenerator = memo(
  forwardRef<IReceiveShareImageGeneratorRef, IShareImageGeneratorProps>(
    ({ data }, ref) => {
      const viewShotRef = useRef<ViewShot>(null);
      const imagesReadyDeferredRef = useRef<IImagesReadyDeferred | null>(null);
      const prevImagesKeyRef = useRef<string | null>(null);
      const prevContentKeyRef = useRef<string | null>(null);
      const lastBase64Ref = useRef<string | null>(null);

      const contentKey = [
        data.title,
        data.subtitle,
        data.networkName,
        data.address,
        data.tokenLogoURI,
        data.networkLogoURI,
      ].join('\u0000');

      const imagesKey = `${data.tokenLogoURI ?? ''}|${data.networkLogoURI ?? ''}`;
      if (
        imagesReadyDeferredRef.current === null ||
        prevImagesKeyRef.current !== imagesKey
      ) {
        imagesReadyDeferredRef.current = createImagesReadyDeferred();
        prevImagesKeyRef.current = imagesKey;
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
              width: SHARE_CARD_CONFIG.width,
            }}
          >
            {/* keyed remount: the renderer's load counter and reveal state
                must reset in lockstep with the deferred above when the logo
                URIs change, or a stale count resolves the new deferred before
                the images actually rendered (OK-58189) */}
            <ShareContentRenderer
              key={imagesKey}
              data={data}
              onImagesReady={handleImagesReady}
            />
          </ViewShot>
        </Stack>
      );
    },
  ),
);

ShareImageGenerator.displayName = 'ShareImageGenerator';
