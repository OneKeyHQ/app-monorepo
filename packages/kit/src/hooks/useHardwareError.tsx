import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { DialogManager, ToastManager } from '@onekeyhq/components';
import NeedBridgeDialog from '@onekeyhq/kit/src/components/NeedBridgeDialog';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { CustomOneKeyHardwareError } from '../utils/hardware/errors';

export function useHardwareError() {
  const intl = useIntl();

  const showMessage = useCallback(
    (key = 'action__connection_timeout', type = 'default') => {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: key as unknown as any }),
        },
        { type },
      );
    },
    [intl],
  );

  const captureHardwareError = useCallback(
    (error: any) => {
      debugLogger.hardwareSDK.debug('captureHardwareError: ', error);
      const { code, key } = error || {};
      if (code === CustomOneKeyHardwareError.NeedOneKeyBridge) {
        DialogManager.show({ render: <NeedBridgeDialog /> });
        return;
      }
      showMessage(key, 'error');
    },
    [showMessage],
  );

  return {
    captureHardwareError,
  };
}
