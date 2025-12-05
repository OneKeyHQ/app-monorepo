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

// Utility function to check if text looks like a valid URL without protocol
function isUrlWithoutProtocol(text: string): boolean {
  // Match patterns like: onekey.so/invite/ABC123, www.example.com, etc.
  const urlPattern =
    /^(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?$/;
  return urlPattern.test(text);
}

// Utility function to ensure URL has https:// prefix
function ensureHttpsPrefix(url: string): string {
  if (!url) return url;
  // Already has protocol
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  // Looks like a URL without protocol, add https://
  if (isUrlWithoutProtocol(url)) {
    return `https://${url}`;
  }
  return url;
}

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

  const copyUrl = useCallback(
    (url: string, successMessageId?: ETranslations, showToast = true) => {
      const processedUrl = ensureHttpsPrefix(url);
      copyText(processedUrl, successMessageId, showToast);
    },
    [copyText],
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
      copyUrl,
      clearText,
      onPasteClearText,
      getClipboard,
      supportPaste,
    }),
    [clearText, onPasteClearText, copyText, copyUrl, supportPaste],
  );
}
