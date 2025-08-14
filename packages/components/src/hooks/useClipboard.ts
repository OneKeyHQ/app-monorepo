import { useCallback, useMemo } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Toast } from '../actions/Toast';

import type { IPasteEventParams } from '../forms';

const getClipboard = async () => {
  const str = await getStringAsync();
  return str.trim();
};

export function useClipboard() {
  const intl = useIntl();
  const supportPaste = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      return false;
    }
    return true;
  }, []);

  const copyText = useCallback(
    (text: string, successMessageId?: ETranslations, showToast = true) => {
      if (!text) return;
      setTimeout(() => setStringAsync(text), 200);
      if (showToast) {
        Toast.success({
          title: intl.formatMessage({
            id: successMessageId || ETranslations.global_copied,
          }),
        });
      }
    },
    [intl],
  );

  const debounceToastClearSuccess = useDebouncedCallback(() => {
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.feedback_pasted_and_cleared,
      }),
    });
  }, 250);

  const clearText = useCallback(() => {
    void setStringAsync('');
    debounceToastClearSuccess();
  }, [debounceToastClearSuccess]);

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
    () => ({
      copyText,
      clearText,
      onPasteClearText,
      getClipboard,
      supportPaste,
    }),
    [clearText, onPasteClearText, copyText, supportPaste],
  );
}
