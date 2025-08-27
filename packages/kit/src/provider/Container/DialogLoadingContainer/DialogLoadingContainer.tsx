import { useEffect, useMemo, useState } from 'react';

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

export function DialogLoadingContainer() {
  // const dialogRef = useRef<IDialogInstance | null>(null);
  const [key, setKey] = useState<string | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading] | undefined
  >();
  useEffect(() => {
    // OK-42375
    // Force re-render when zIndex changes to ensure proper stacking
    const forceRender = () => {
      if (platformEnv.isNativeIOS) {
        setKey(Math.random().toString());
      }
    };
    const hideFn = async () => {
      // await dialogRef.current?.close();
      setVisible(false);
      // setPayload(undefined);
      forceRender();
    };
    const showFn = async (
      p: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    ) => {
      // await hideFn();
      // dialogRef.current = Dialog.loading(payload);
      setVisible(true);
      setPayload(p);
      forceRender();
    };
    appEventBus.on(EAppEventBusNames.ShowDialogLoading, showFn);
    appEventBus.on(EAppEventBusNames.HideDialogLoading, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowDialogLoading, showFn);
      appEventBus.off(EAppEventBusNames.HideDialogLoading, hideFn);
    };
  }, []);

  console.log('key', key, visible, payload?.title);
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
