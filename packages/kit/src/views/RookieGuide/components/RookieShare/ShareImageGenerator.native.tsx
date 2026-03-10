import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import { CANVAS_CONFIG } from './constants';
import { ShareContentRenderer } from './ShareContentRenderer';

interface IShareImageGeneratorProps {
  data: IRookieShareData;
}

async function fileUriToBase64(uri: string): Promise<string> {
  if (!RNFS) return '';
  const cleanUri = uri.replace(/^file:\/\//, '');
  const base64Content = await RNFS.readFile(cleanUri, 'base64');
  return `data:image/png;base64,${base64Content}`;
}

export const ShareImageGenerator = forwardRef<
  IRookieShareImageGeneratorRef,
  IShareImageGeneratorProps
>(({ data }, ref) => {
  const viewShotRef = useRef<ViewShot>(null);

  const generate = useCallback(async (): Promise<string> => {
    const viewShot = viewShotRef.current;
    if (!viewShot) return '';

    try {
      const fileUri = await viewShot.capture?.();
      if (!fileUri) return '';
      return await fileUriToBase64(fileUri);
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
        style={{
          width: CANVAS_CONFIG.size,
          height: CANVAS_CONFIG.size,
        }}
      >
        <ShareContentRenderer data={data} />
      </ViewShot>
    </Stack>
  );
});

ShareImageGenerator.displayName = 'ShareImageGenerator';
