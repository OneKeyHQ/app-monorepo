import { useIntl } from 'react-intl';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  primeTransferAtom,
  usePrimeTransferAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PrimeTransferProgress,
  primeTransferProgressDialogProps,
} from './PrimeTransferProgress';

import type { IntlShape } from 'react-intl';

function PrimeTransferProcessingDialogContent() {
  const intl = useIntl();
  const [{ preparationProgress, networkProgress }] = usePrimeTransferAtom();
  let value = preparationProgress?.percentage;
  if (networkProgress) {
    value = networkProgress.indeterminate
      ? undefined
      : Math.floor(
          (100 * networkProgress.transferredBytes) / networkProgress.totalBytes,
        );
  }
  return (
    <Stack>
      <PrimeTransferProgress
        testID={
          networkProgress
            ? 'prime-transfer-network-progress'
            : 'prime-transfer-preparation-progress'
        }
        value={value}
        label={
          <SizableText size="$bodyLg" textAlign="center">
            {intl.formatMessage({
              id: networkProgress
                ? ETranslations.hardware_transferring_data
                : ETranslations.global_preparing,
            })}
            {value === undefined ? '' : ` ${value}%`}
          </SizableText>
        }
        description={intl.formatMessage({
          id: ETranslations.transfer_keep_foreground__desc,
        })}
      />
      <Dialog.Footer showConfirmButton={false} showCancelButton={false} />
    </Stack>
  );
}

export function showPrimeTransferProcessingDialog(
  intl: IntlShape,
  taskId: string,
) {
  let finished = false;
  let confirmation: Promise<boolean> | undefined;
  let confirmationDialog: ReturnType<typeof Dialog.show> | undefined;
  const isActive = async () => {
    const state = await primeTransferAtom.get();
    return (
      !finished &&
      (state.preparationProgress?.taskId === taskId ||
        state.networkProgress?.transferId === taskId)
    );
  };
  const dialog = Dialog.show({
    ...primeTransferProgressDialogProps,
    renderContent: <PrimeTransferProcessingDialogContent />,
    onBeforeClose: async () => {
      if (!(await isActive())) return true;
      confirmation ??= new Promise<boolean>((resolve) => {
        confirmationDialog = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.confirm_exit_dialog_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.confirm_exit_dialog_desc,
          }),
          onConfirmText: intl.formatMessage({ id: ETranslations.global_quit }),
          onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
          disableDrag: true,
          dismissOnOverlayPress: false,
          onConfirm: () => resolve(true),
          onClose: () => resolve(false),
        });
      });
      const confirmed = await confirmation;
      confirmation = undefined;
      if (!(await isActive())) return true;
      if (!confirmed) return false;
      await backgroundApiProxy.servicePrimeTransfer.cancelTransfer({ taskId });
      return true;
    },
  });
  return {
    taskId,
    close: async () => {
      finished = true;
      await confirmationDialog?.close();
      await dialog.close();
    },
  };
}
