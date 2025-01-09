import { useCallback, useMemo } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Toast } from '../actions/Toast';

import type { IPasteEventParams } from '../forms';

const getClipboard = async () => {
  const str = await getStringAsync();
  return str.trim();
};

export function useClipboard() {
  const intl = useIntl();

  const copyText = useCallback(
    (text: string, successMessageId?: ETranslations) => {
      if (!text) return;
      setTimeout(() => setStringAsync(text), 200);
      Toast.success({
        title: intl.formatMessage({
          id: successMessageId || ETranslations.global_copied,
        }),
      });
    },
    [intl],
  );

  const clearText = useCallback(() => {
    void setStringAsync('');
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.feedback_pasted_and_cleared,
      }),
    });
  }, [intl]);

  const onPasteClearText = useCallback(
    (event: IPasteEventParams) => {
      if (!event.nativeEvent.items?.length) {
        return;
      }

      const hasText = event.nativeEvent.items.some(
        (item) => item.type === 'text/plain' && item.data?.trim() !== '',
      );

      if (!hasText) {
        return;
      }

      setTimeout(() => {
        clearText();
      }, 100);
    },
    [clearText],
  );

  return useMemo(
    () => ({ copyText, clearText, onPasteClearText, getClipboard }),
    [clearText, onPasteClearText, copyText],
  );
}
