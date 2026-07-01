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
  const isDialogActiveRef = useRef(false);
  const isDetailsDialogActiveRef = useRef(false);

  const showDetailsDialog = useCallback(async (technicalMessage: string) => {
    await dialogRef.current?.close();
    dialogRef.current = null;
    isDialogActiveRef.current = false;
    if (isDetailsDialogActiveRef.current) {
      return;
    }
    isDetailsDialogActiveRef.current = true;
    detailsDialogRef.current = Dialog.show({
      title: ERROR_DETAILS_TITLE,
      description: technicalMessage,
      onConfirmText: OK_TEXT,
      onClose: () => {
        detailsDialogRef.current = null;
        isDetailsDialogActiveRef.current = false;
      },
      showCancelButton: false,
    });
  }, []);

  useEffect(() => {
    const showFn = (
      payload: IAppEventBusPayload[EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog],
    ) => {
      if (isDialogActiveRef.current || isDetailsDialogActiveRef.current) {
        return;
      }
      isDialogActiveRef.current = true;
      dialogRef.current = Dialog.show({
        icon: 'ErrorOutline',
        title: WALLET_KEY_UNAVAILABLE_TITLE,
        description: WALLET_KEY_UNAVAILABLE_DESCRIPTION,
        onConfirmText: OK_TEXT,
        onCancelText: VIEW_ERROR_DETAILS_TEXT,
        onCancel: (close) => {
          void close().then(() => {
            dialogRef.current = null;
            isDialogActiveRef.current = false;
            void showDetailsDialog(payload.technicalMessage);
          });
        },
        onClose: () => {
          dialogRef.current = null;
          isDialogActiveRef.current = false;
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
      isDialogActiveRef.current = false;
      isDetailsDialogActiveRef.current = false;
    };
  }, [showDetailsDialog]);

  return null;
}
