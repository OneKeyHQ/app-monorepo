import { useCallback } from 'react';

import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useAppExitPrevent } from '../../Prime/pages/PagePrimeTransfer/components/hooks/usePrimeTransferHooks';

export function CloudBackupExitPrevent({
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

  // Prevents screen locking during transfer
  useKeepAwake();

  // Prevent Modal exit/back
  // useModalExitPrevent({
  //   shouldPreventRemove,
  //   title,
  //   message,
  //   onConfirm: onConfirmCallback,
  // });

  // Prevent App exit
  useAppExitPrevent({
    title,
    message,
    shouldPreventExitOnAndroid: true,
  });

  return null;
}
