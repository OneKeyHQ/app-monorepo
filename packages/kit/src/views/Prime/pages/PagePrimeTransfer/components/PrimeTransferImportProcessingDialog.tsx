import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Progress,
  SizableText,
  Stack,
  XStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function PrimeTransferImportProcessingDialogContent({
  navigation,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
}: {
  navigation?: IAppNavigation;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const [isCancelled, setIsCancelled] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { importProgress } = primeTransferAtom;
  const isDone = useMemo(
    () =>
      Boolean(
        importProgress &&
          !importProgress.isImporting &&
          importProgress.current === importProgress.total,
      ),
    [importProgress],
  );

  useEffect(() => {
    if (closeAfterDone && isDone) {
      void dialogInstance.close();
    }
    if (closeAfterCancel && isCancelled) {
      void dialogInstance.close();
    }
    if (closeAfterError && hasError) {
      void dialogInstance.close();
    }
  }, [
    closeAfterDone,
    isDone,
    dialogInstance,
    closeAfterCancel,
    isCancelled,
    closeAfterError,
    hasError,
  ]);

  const isFlowEnded = isDone || isCancelled || hasError;
  const progressPercentage = importProgress
    ? Math.ceil((importProgress.current / importProgress.total) * 100)
    : 0;

  useEffect(() => {
    const cb = async (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      payload: IAppEventBusPayload[EAppEventBusNames.BatchCreateAccount],
    ) => {
      await backgroundApiProxy.servicePrimeTransfer.updateImportProgress();
    };
    appEventBus.on(EAppEventBusNames.BatchCreateAccount, cb);

    return () => {
      appEventBus.off(EAppEventBusNames.BatchCreateAccount, cb);
    };
  }, []);

  /*
  Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.transfer_transfer_data_completed,
            }),
            showCancelButton: false,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_done,
            }),
            disableDrag: true,
            dismissOnOverlayPress: false,
          });
          */

  return (
    <Stack>
      <Stack
        py="$2.5"
        px="$5"
        gap="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          alignSelf="center"
          w="100%"
          maxWidth="$80"
        >
          {isDone ? (
            <Icon name="CheckRadioSolid" size="$12" color="$iconSuccess" />
          ) : null}

          {(isCancelled || hasError) && !isDone ? (
            <Icon name="XCircleSolid" size="$12" color="$iconCritical" />
          ) : null}

          {!isFlowEnded && importProgress ? (
            <Progress
              mt="$4"
              w="100%"
              size="medium"
              value={progressPercentage}
            />
          ) : null}

          <XStack mt="$5" alignItems="center" gap="$2">
            <SizableText size="$bodyLg" textAlign="center">
              {(() => {
                if (isDone || importProgress) {
                  return intl.formatMessage(
                    {
                      id: ETranslations.global_bulk_accounts_loading,
                    },
                    {
                      amount: importProgress?.current ?? 0,
                    },
                  );
                }
                if (isCancelled) {
                  return intl.formatMessage({
                    id: ETranslations.global_cancel,
                  });
                }
                if (hasError) {
                  return intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  });
                }
                return intl.formatMessage({
                  id: ETranslations.transfer_transfer_loading,
                });
              })()}
            </SizableText>
          </XStack>
        </Stack>
      </Stack>

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton={isFlowEnded} // cancel import not supported yet
        confirmButtonProps={{
          variant: isFlowEnded ? 'primary' : 'secondary',
          testID: 'prime-transfer-import-dialog-confirm-button',
        }}
        onConfirmText={
          isFlowEnded
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_cancel })
        }
        onConfirm={
          isFlowEnded
            ? async () => {
                if (!isCancelled) {
                  navigation?.popStack();
                }
                setTimeout(async () => {
                  await backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
                }, 600);
              }
            : async ({ preventClose }) => {
                preventClose();
                setIsCancelled(true);
                setTimeout(async () => {
                  await backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
                }, 600);
              }
        }
      />
    </Stack>
  );
}

export function showPrimeTransferImportProcessingDialog({
  navigation,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
  ...dialogProps
}: IDialogShowProps & {
  navigation?: IAppNavigation;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
}) {
  Dialog.show({
    showExitButton: false,
    dismissOnOverlayPress: false,
    onCancel() {
      void backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
    },
    onClose() {
      void backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
    },
    title: '',
    renderContent: (
      <PrimeTransferImportProcessingDialogContent
        navigation={navigation}
        closeAfterDone={closeAfterDone}
        closeAfterCancel={closeAfterCancel}
        closeAfterError={closeAfterError}
      />
    ),
    ...dialogProps,
  });
}
