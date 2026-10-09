import { useEffect, useRef, useState } from 'react';

import { Image as RNImage, StyleSheet } from 'react-native';

import { Image, Spinner, Stack } from '@onekeyhq/components';

import { REFERRAL_SHARE_CARD } from './constants';
import { ShareImageGenerator } from './ShareImageGenerator';

import type {
  IReferralShareData,
  IReferralShareImageGeneratorRef,
} from './types';

// Initial guess until the generated image reports its real size.
const INITIAL_ASPECT_RATIO = REFERRAL_SHARE_CARD.width / 440;

// Shows the generated card as an image, so the preview is exactly what gets
// saved or shared. The box contain-fits under `maxHeight` so the action row
// below always stays on screen.
export function ShareView({
  data,
  generatorRef,
  maxHeight,
}: {
  data: IReferralShareData;
  generatorRef: React.RefObject<IReferralShareImageGeneratorRef | null>;
  maxHeight?: number;
}) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(INITIAL_ASPECT_RATIO);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!previewImage) {
      return;
    }
    RNImage.getSize(
      previewImage,
      (imgWidth, imgHeight) => {
        if (imgWidth > 0 && imgHeight > 0 && isMountedRef.current) {
          setAspectRatio(imgWidth / imgHeight);
        }
      },
      () => {},
    );
  }, [previewImage]);

  useEffect(() => {
    // One tick so the offscreen generator has mounted before it is asked.
    const timer = setTimeout(() => {
      void (async () => {
        const base64 = await generatorRef.current?.generate();
        if (base64 && isMountedRef.current) {
          setPreviewImage(base64);
        }
      })();
    }, 50);
    return () => clearTimeout(timer);
  }, [data, generatorRef]);

  return (
    <Stack
      width="100%"
      maxWidth={maxHeight ? maxHeight * aspectRatio : undefined}
      alignSelf="center"
      aspectRatio={aspectRatio}
      borderRadius={16}
      borderCurve="continuous"
      // outlines the image area in the dialog; the exported image has none
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      overflow="hidden"
      bg="$bgSubdued"
      ai="center"
      jc="center"
    >
      {previewImage ? (
        <Image
          width="100%"
          height="100%"
          source={{ uri: previewImage }}
          resizeMode="contain"
        />
      ) : (
        <Spinner size="large" />
      )}
      <ShareImageGenerator ref={generatorRef} data={data} />
    </Stack>
  );
}
