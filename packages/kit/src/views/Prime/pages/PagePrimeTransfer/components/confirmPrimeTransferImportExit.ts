import { Dialog } from '@onekeyhq/components';
import { primeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

let pendingConfirmation: Promise<boolean> | undefined;

export async function confirmPrimeTransferImportExit(
  intl: IntlShape,
): Promise<boolean> {
  const { importProgress } = await primeTransferAtom.get();
  if (!importProgress?.isImporting) return true;
  if (pendingConfirmation) return pendingConfirmation;
  pendingConfirmation = new Promise<boolean>((resolve) => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.confirm_exit_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.transfer_exit_import__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_quit,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_cancel,
      }),
      disableDrag: true,
      dismissOnOverlayPress: false,
      onConfirm: () => resolve(true),
      onClose: () => resolve(false),
    });
  }).finally(() => {
    pendingConfirmation = undefined;
  });
  return pendingConfirmation;
}
