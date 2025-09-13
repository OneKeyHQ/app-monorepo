import { useCallback } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  useAppExitPrevent,
  useModalExitPrevent,
} from './hooks/usePrimeTransferHooks';

export function PrimeTransferExitPrevent({
  shouldPreventRemove = true,
}: {
  shouldPreventRemove?: boolean;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({
    id: ETranslations.confirm_exit_dialog_title,
  });
  const message = intl.formatMessage({
    id: ETranslations.confirm_exit_dialog_desc,
  });

  const onConfirmCallback = useCallback(async () => {
    try {
      await backgroundApiProxy.servicePrimeTransfer.clearSensitiveData();
    } catch (error) {
      console.error('onConfirmCallback clearSensitiveData error', error);
    }
    try {
      await backgroundApiProxy.servicePrimeTransfer.handleLeaveRoom();
    } catch (error) {
      console.error('onConfirmCallback handleLeaveRoom error', error);
    }
    try {
      await timerUtils.wait(600);
      await backgroundApiProxy.servicePrimeTransfer.refreshQrcodeHook();
    } catch (error) {
      console.error('onConfirmCallback refreshQrcodeHook error', error);
    }
  }, []);

  // Prevents screen locking during transfer
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({
    shouldPreventRemove,
    title,
    message,
    onConfirm: onConfirmCallback,
  });

  // Prevent App exit
  useAppExitPrevent({
    title,
    message,
    shouldPreventExitOnAndroid: true,
  });

  return null;
}
