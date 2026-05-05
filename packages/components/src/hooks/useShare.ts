import { useCallback, useMemo } from 'react';

import { Share } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useClipboard } from './useClipboard';

export function useShare() {
  const { copyText } = useClipboard();
  const shareText = useCallback(
    async (text: string) => {
      // On mobile devices, use native share functionality
      if (platformEnv.isNative) {
        await Share.share({
          message: text,
        });
        return;
      }
      // On desktop/web, just copy link and show success message
      copyText(text, ETranslations.global_link_copied);
    },
    [copyText],
  );

  return useMemo(() => ({ shareText }), [shareText]);
}
