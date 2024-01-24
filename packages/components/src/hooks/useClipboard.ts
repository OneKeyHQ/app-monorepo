import { useCallback } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Toast } from '../actions/Toast';

import type { ILocaleIds } from '../locale';

const getClipboard = async () => {
  if (!platformEnv.canGetClipboard) {
    throw new Error('getClipboard is not allowed in Web and Extension');
  }
  const str = await getStringAsync();
  return str.trim();
};

export function useClipboard() {
  const intl = useIntl();

  const { canGetClipboard } = platformEnv;
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

  return { copyText, getClipboard, canGetClipboard };
}
