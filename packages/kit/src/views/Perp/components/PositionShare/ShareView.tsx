import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Image,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpTestIDs } from '../../testIDs';

import { getCanvasConfig } from './constants';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
  IShareReferralInfo,
} from './types';

const CANVAS_CONFIG = getCanvasConfig(900);

// Last-resort deadline. The generator already bounds every image load, so this
// only catches an unforeseen stall — but it must exist, because a spinner with
// no way out is worse than an explicit retry.
const PREVIEW_TIMEOUT_MS = 5000;

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
  generatorRef,
}: IShareViewProps) {
  const intl = useIntl();
  const displaySize = CANVAS_CONFIG.size * scale;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const generationIdRef = useRef(0);

  // The referral invite code is not awaited: referralQrCodeUrl always carries a
  // working default, so the card is drawn immediately and this effect re-runs to
  // redraw once the code arrives and changes the URL.
  useEffect(() => {
    generationIdRef.current += 1;
    const currentGenerationId = generationIdRef.current;
    setIsGenerating(true);
    setHasFailed(false);

    const watchdog = setTimeout(() => {
      if (currentGenerationId === generationIdRef.current) {
        setIsGenerating(false);
        setHasFailed(true);
      }
    }, PREVIEW_TIMEOUT_MS);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const generator = generatorRef.current;
          const base64 = generator ? await generator.generate() : '';
          // Only update if this is still the current generation. A result that
          // lands after the watchdog fired still clears the retry state.
          if (currentGenerationId !== generationIdRef.current) {
            return;
          }
          if (base64) {
            setPreviewImage(base64);
            setHasFailed(false);
          } else {
            setHasFailed(true);
          }
        } finally {
          if (currentGenerationId === generationIdRef.current) {
            setIsGenerating(false);
          }
        }
      })();
    }, 50);

    return () => {
      clearTimeout(timer);
      clearTimeout(watchdog);
    };
  }, [
    data,
    config,
    referralQrCodeUrl,
    referralDisplayText,
    generatorRef,
    retryNonce,
  ]);

  const handleRetry = useCallback(() => {
    setHasFailed(false);
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  // A redraw keeps the previous card on screen, so the spinner and the retry
  // state only ever cover the very first generation.
  const showSpinner = isGenerating && !previewImage;
  const showRetry = hasFailed && !isGenerating && !previewImage;

  return (
    <Stack
      width={displaySize}
      height={displaySize}
      borderRadius="$6"
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
      {showSpinner || showRetry ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
          gap="$3"
          backgroundColor="$bgSubdued"
        >
          {showRetry ? (
            <>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_an_error_occurred,
                })}
              </SizableText>
              <Button
                size="small"
                testID={PerpTestIDs.PositionShareRetryButton}
                onPress={handleRetry}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
            </>
          ) : (
            <Spinner size="large" />
          )}
        </YStack>
      ) : null}
    </Stack>
  );
}
