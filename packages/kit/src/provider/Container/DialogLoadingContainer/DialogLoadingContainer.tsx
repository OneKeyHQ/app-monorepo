import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DialogContainer,
  DialogLoadingView,
  Portal,
} from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function DialogLoadingContainer() {
  // const dialogRef = useRef<IDialogInstance | null>(null);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading] | undefined
  >();
  const [count, setCount] = useState(0);
  const updateCount = useCallback(() => {
    if (platformEnv.isNativeIOS) {
      setCount((c) => c + 1);
    }
  }, []);
  useEffect(() => {
    const hideFn = async () => {
      await timerUtils.wait(50);
      // await dialogRef.current?.close();
      setVisible(false);
      // setPayload(undefined);
      updateCount();
    };
    const showFn = async (
      p: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    ) => {
      // await hideFn();
      // dialogRef.current = Dialog.loading(payload);
      // OK-42375
      // Delay rendering to ensure proper sheet z-index
      await timerUtils.wait(50);
      setVisible(true);
      setPayload(p);
      updateCount();
    };
    appEventBus.on(EAppEventBusNames.ShowDialogLoading, showFn);
    appEventBus.on(EAppEventBusNames.HideDialogLoading, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowDialogLoading, showFn);
      appEventBus.off(EAppEventBusNames.HideDialogLoading, hideFn);
    };
  }, [updateCount]);

  const key = useMemo(() => {
    // OK-42375
    // Ensure the dialog appears above all other content with proper z-index
    if (platformEnv.isNativeIOS) {
      return `${visible ? 1 : 0}-${count}`;
    }
    return undefined;
  }, [count, visible]);

  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <DialogContainer
        key={key}
        open={visible}
        // ref={dialogRef}
        // onClose={buildForwardOnClose({ onClose })}
        // isExist={isExist}
        onClose={async () => {
          setVisible(false);
          updateCount();
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
    </Portal.Body>
  );
}
