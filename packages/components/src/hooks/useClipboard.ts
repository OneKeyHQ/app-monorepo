import { useCallback, useMemo } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Toast } from '../actions/Toast';

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

  return useMemo(
    () => ({ copyText, clearText, getClipboard }),
    [clearText, copyText],
  );
}
