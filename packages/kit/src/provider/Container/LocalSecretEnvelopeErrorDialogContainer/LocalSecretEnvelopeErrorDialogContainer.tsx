import { useCallback, useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

const WALLET_KEY_UNAVAILABLE_TITLE = 'Wallet key unavailable';
const WALLET_KEY_UNAVAILABLE_DESCRIPTION =
  'This device no longer has the local security key required to unlock this wallet. This can happen after moving to a new device, reinstalling the app, or clearing local app data. Re-import this wallet using a recovery method you choose, such as Cloud Backup restore, Transfer, or another supported import method.';
const ERROR_DETAILS_TITLE = 'Error details';
const VIEW_ERROR_DETAILS_TEXT = 'View error details';
const OK_TEXT = 'OK';

export function LocalSecretEnvelopeErrorDialogContainer() {
  const dialogRef = useRef<IDialogInstance | null>(null);
  const detailsDialogRef = useRef<IDialogInstance | null>(null);

  const showDetailsDialog = useCallback(async (technicalMessage: string) => {
    await dialogRef.current?.close();
    dialogRef.current = null;
    if (detailsDialogRef.current?.isExist()) {
      return;
    }
    detailsDialogRef.current = Dialog.show({
      title: ERROR_DETAILS_TITLE,
      description: technicalMessage,
      onConfirmText: OK_TEXT,
      showCancelButton: false,
    });
  }, []);

  useEffect(() => {
    const showFn = (
      payload: IAppEventBusPayload[EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog],
    ) => {
      if (dialogRef.current?.isExist()) {
        return;
      }
      dialogRef.current = Dialog.show({
        icon: 'ErrorOutline',
        title: WALLET_KEY_UNAVAILABLE_TITLE,
        description: WALLET_KEY_UNAVAILABLE_DESCRIPTION,
        onConfirmText: OK_TEXT,
        onCancelText: VIEW_ERROR_DETAILS_TEXT,
        onCancel: (close) => {
          void close().then(() => {
            dialogRef.current = null;
            void showDetailsDialog(payload.technicalMessage);
          });
        },
        showCancelButton: true,
      });
    };

    appEventBus.on(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      showFn,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
        showFn,
      );
      dialogRef.current = null;
      detailsDialogRef.current = null;
    };
  }, [showDetailsDialog]);

  return null;
}
