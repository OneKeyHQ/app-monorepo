import { useCallback } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';

import { Toast } from '../actions/Toast';

import type { ILocaleIds } from '../locale';

const getClipboard = async () => {
  const str = await getStringAsync();
  return str.trim();
};

export function useClipboard() {
  const intl = useIntl();

  const copyText = useCallback(
    (text: string, successMessageId?: ILocaleIds) => {
      if (!text) return;
      setTimeout(() => setStringAsync(text), 200);
      Toast.success({
        title: intl.formatMessage({ id: successMessageId || 'msg__copied' }),
      });
    },
    [intl],
  );

  return { copyText, getClipboard };
}
