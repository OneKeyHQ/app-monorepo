import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  copyToClipboard,
  getClipboard,
} from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useClipboard() {
  const intl = useIntl();

  const { canGetClipboard } = platformEnv;
  const copyText = useCallback(
    (address: string, successMessageId?: LocaleIds) => {
      if (!address) return;
      setTimeout(() => copyToClipboard(address), 200);
      // msg__copied
      // msg__address_copied
      // msg__url_copied
      ToastManager.show({
        title: intl.formatMessage({ id: successMessageId || 'msg__copied' }),
      });
    },
    [intl],
  );

  return { copyText, getClipboard, canGetClipboard };
}
