import { useCallback, useMemo } from 'react';

import { Share } from 'react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';

// oxlint-disable-next-line import/no-cycle
import { useClipboard } from './useClipboard';

export function useShare() {
  const { copyText } = useClipboard();
  const shareText = useCallback(
    async (text: string) => {
      await Share.share({
        message: text,
      });
      copyText(text, ETranslations.global_link_copied);
    },
    [copyText],
  );

  return useMemo(() => ({ shareText }), [shareText]);
}
