import { Dialog } from '@onekeyhq/components';
import { primeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

const pendingConfirmations = new Map<string | undefined, Promise<boolean>>();

export async function confirmPrimeTransferImportExit(
  intl: IntlShape,
  taskUUID?: string,
): Promise<boolean> {
  const { importProgress } = await primeTransferAtom.get();
  const owner = taskUUID ?? importProgress?.taskUUID;
  if (!importProgress?.isImporting || importProgress.taskUUID !== owner)
    return true;
  let pendingConfirmation = pendingConfirmations.get(owner);
  if (!pendingConfirmation) {
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
      pendingConfirmations.delete(owner);
    });
    pendingConfirmations.set(owner, pendingConfirmation);
  }
  const confirmed = await pendingConfirmation;
  // A pending user choice must not veto cleanup after this import has ended.
  const { importProgress: latestProgress } = await primeTransferAtom.get();
  return (
    confirmed ||
    !latestProgress?.isImporting ||
    latestProgress.taskUUID !== owner
  );
}
