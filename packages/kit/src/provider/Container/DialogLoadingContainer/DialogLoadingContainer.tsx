import { useEffect, useRef } from 'react';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

export function DialogLoadingContainer() {
  const dialogRef = useRef<IDialogInstance | null>(null);
  useEffect(() => {
    const hideFn = async () => {
      await dialogRef.current?.close();
    };
    const showFn = async (
      payload: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    ) => {
      await hideFn();
      dialogRef.current = Dialog.loading(payload);
    };
    appEventBus.on(EAppEventBusNames.ShowDialogLoading, showFn);
    appEventBus.on(EAppEventBusNames.HideDialogLoading, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowDialogLoading, showFn);
      appEventBus.off(EAppEventBusNames.HideDialogLoading, hideFn);
    };
  }, []);
  return null;
}
