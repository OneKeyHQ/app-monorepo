import { useCallback, useMemo, useRef } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ensureHttpsPrefix } from '@onekeyhq/shared/src/utils/uriUtils';

import { Toast } from '../actions/Toast';

import type { IPasteEventParams } from '../forms';

const getClipboard = async () => {
  const str = await getStringAsync();
  return str.trim();
};

const ANDROID_COPY_TAP_THRESHOLD = 3;
const ANDROID_COPY_TAP_WINDOW_MS = 15_000;

export function useClipboard() {
  const intl = useIntl();
  const androidCopyTimestamps = useRef<number[]>([]);
  const supportPaste = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      return false;
    }
    return true;
  }, []);

  const checkAndroidRepeatedCopy = useCallback(() => {
    if (!platformEnv.isNativeAndroid) {
      return false;
    }
    const now = Date.now();
    androidCopyTimestamps.current.push(now);
    // Keep only timestamps within the window
    androidCopyTimestamps.current = androidCopyTimestamps.current.filter(
      (t) => now - t < ANDROID_COPY_TAP_WINDOW_MS,
    );
    if (androidCopyTimestamps.current.length >= ANDROID_COPY_TAP_THRESHOLD) {
      // Reset after showing warning
      androidCopyTimestamps.current = [];
      return true;
    }
    return false;
  }, []);

  const copyText = useCallback(
    (text: string, successMessageId?: ETranslations, showToast = true) => {
      if (!text) return;
      setTimeout(() => setStringAsync(text), 200);
      if (showToast) {
        const shouldWarn = checkAndroidRepeatedCopy();
        if (shouldWarn) {
          Toast.warning({
            title: 'Copy may not be working',
            message:
              'Your device may restrict clipboard access. Please check clipboard permissions in your device settings.',
          });
        } else {
          Toast.success({
            title: intl.formatMessage({
              id: successMessageId || ETranslations.global_copied,
            }),
          });
        }
      }
    },
    [intl, checkAndroidRepeatedCopy],
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
