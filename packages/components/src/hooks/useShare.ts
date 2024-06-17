import { useCallback, useMemo } from 'react';

import * as ExpoSharing from 'expo-sharing';
import { Share } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useClipboard } from './useClipboard';

export function useShare() {
  const { copyText } = useClipboard();
  const shareText = useCallback(
    async (text: string) => {
      if (platformEnv.isNativeIOS) {
        if (await ExpoSharing.isAvailableAsync()) {
          // https://docs.expo.dev/versions/latest/sdk/sharing/
          await ExpoSharing.shareAsync(text);
          return;
        }
      }
      if (platformEnv.isNativeAndroid) {
        await Share.share({
          message: text,
        });
        return;
      }
      copyText(text, ETranslations.global_link_copied);
    },
    [copyText],
  );

  return useMemo(() => ({ shareText }), [shareText]);
}
