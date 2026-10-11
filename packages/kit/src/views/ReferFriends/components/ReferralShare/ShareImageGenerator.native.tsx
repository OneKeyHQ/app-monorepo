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

import { REFERRAL_SHARE_CARD } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

import type {
  IReferralShareData,
  IReferralShareImageGeneratorRef,
} from './types';
import type { ViewShotRef } from 'react-native-view-shot';

const IMAGES_READY_TIMEOUT_MS = 5000;

// Renders the card offscreen and captures it once its logo and QR code have
// drawn, the same way the receive share card does.
export const ShareImageGenerator = memo(
  forwardRef<IReferralShareImageGeneratorRef, { data: IReferralShareData }>(
    ({ data }, ref) => {
      const viewShotRef = useRef<ViewShotRef>(null);
      const imagesReadyRef = useRef<{
        promise: Promise<void>;
        resolve: () => void;
      } | null>(null);
      if (!imagesReadyRef.current) {
        let resolve: () => void = () => {};
        const promise = new Promise<void>((r) => {
          resolve = r;
        });
        imagesReadyRef.current = { promise, resolve };
      }
      const lastBase64Ref = useRef<string | null>(null);

      const handleImagesReady = useCallback(() => {
        imagesReadyRef.current?.resolve();
      }, []);

      // The preview and an early Save/More tap can ask at once; they share
      // one capture instead of each rendering the card to an image.
      const pendingRef = useRef<Promise<string> | null>(null);

      const capture = useCallback(async (): Promise<string> => {
        const viewShot = viewShotRef.current;
        if (!viewShot) {
          return '';
        }
        try {
          await createTimeoutPromise({
            asyncFunc: () =>
              imagesReadyRef.current?.promise ?? Promise.resolve(),
            timeout: IMAGES_READY_TIMEOUT_MS,
            timeoutResult: undefined,
          });
          const dataUri = await viewShot.capture?.();
          if (!dataUri) {
            return '';
          }
          lastBase64Ref.current = dataUri;
          return dataUri;
        } catch (error) {
          if (platformEnv.isDev) {
            console.error('Failed to generate referral share image:', error);
          }
          return '';
        }
      }, []);

      const generate = useCallback(async (): Promise<string> => {
        if (lastBase64Ref.current) {
          return lastBase64Ref.current;
        }
        if (!pendingRef.current) {
          pendingRef.current = capture().finally(() => {
            pendingRef.current = null;
          });
        }
        return pendingRef.current;
      }, [capture]);

      useImperativeHandle(ref, () => ({ generate }));

      return (
        <Stack position="absolute" left={-9999} top={-9999} opacity={0}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1.0, result: 'data-uri' }}
            style={{ width: REFERRAL_SHARE_CARD.width }}
          >
            <ShareContentRenderer
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
