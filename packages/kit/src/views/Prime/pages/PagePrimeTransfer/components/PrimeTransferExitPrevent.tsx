import { useCallback } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const [{ importProgress, exitGeneration = 0 }] = usePrimeTransferAtom();
  const title = intl.formatMessage({
    id: ETranslations.confirm_exit_dialog_title,
  });
  const message = intl.formatMessage({
    id: importProgress?.isImporting
      ? ETranslations.transfer_exit_import__desc
      : ETranslations.confirm_exit_dialog_desc,
  });

  const onConfirmCallback = useCallback(
    () =>
      backgroundApiProxy.servicePrimeTransfer.exitTransfer({
        generation: exitGeneration,
      }),
    [exitGeneration],
  );
  const isExitCurrent = useCallback(
    () =>
      backgroundApiProxy.servicePrimeTransfer.isTransferExitCurrent(
        exitGeneration,
      ),
    [exitGeneration],
  );

  // Prevents screen locking during transfer
  useKeepAwake();

  // Prevent Modal exit/back
  useModalExitPrevent({
    shouldPreventRemove,
    title,
    message,
    onConfirm: onConfirmCallback,
    isExitCurrent,
  });

  // Prevent App exit
  useAppExitPrevent({
    title,
    message,
    shouldPreventExitOnAndroid: true,
    onConfirm: onConfirmCallback,
    isExitCurrent,
  });

  return null;
}
