import { useEffect, useState } from 'react';

import { DialogContainer, DialogLoadingView } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

/**
 * The global loading dialog. It renders in the native overlay `modal` level,
 * so it stacks by request order with the other dialogs (shown later means on
 * top) and stays below hardware and password prompts. The text of a visible
 * loading dialog updates in place.
 */
export function DialogLoadingContainer() {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading] | undefined
  >();
  useEffect(() => {
    const hideFn = () => {
      setVisible(false);
    };
    const showFn = (
      p: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    ) => {
      setPayload(p);
      setVisible(true);
    };
    appEventBus.on(EAppEventBusNames.ShowDialogLoading, showFn);
    appEventBus.on(EAppEventBusNames.HideDialogLoading, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowDialogLoading, showFn);
      appEventBus.off(EAppEventBusNames.HideDialogLoading, hideFn);
    };
  }, []);

  return (
    <DialogContainer
      open={visible}
      overlayLevel="modal"
      onClose={async () => {
        setVisible(false);
      }}
      showExitButton={payload?.showExitButton ?? false}
      title={payload?.title}
      dismissOnOverlayPress={false}
      disableDrag
      showFooter={false}
      showConfirmButton={false}
      showCancelButton={false}
      renderContent={<DialogLoadingView />}
    />
  );
}
