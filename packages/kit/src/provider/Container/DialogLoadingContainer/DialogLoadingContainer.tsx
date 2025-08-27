import { useCallback, useEffect, useState } from 'react';

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
  const [visibilityState, setVisibilityState] = useState<{
    visible: boolean;
    key: string | undefined;
  }>({
    visible: false,
    key: undefined,
  });
  const [payload, setPayload] = useState<
    IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading] | undefined
  >();

  const getKey = useCallback(() => {
    if (platformEnv.isNativeIOS) {
      return Math.random().toString();
    }
    return undefined;
  }, []);
  useEffect(() => {
    // OK-42375
    // Force re-render when zIndex changes to ensure proper stacking
    const hideFn = async () => {
      // await dialogRef.current?.close();
      setVisibilityState({ visible: false, key: getKey() });
      // setPayload(undefined);
    };
    const showFn = async (
      p: IAppEventBusPayload[EAppEventBusNames.ShowDialogLoading],
    ) => {
      // await hideFn();
      // dialogRef.current = Dialog.loading(payload);
      setVisibilityState({ visible: true, key: getKey() });
      setPayload(p);
    };
    appEventBus.on(EAppEventBusNames.ShowDialogLoading, showFn);
    appEventBus.on(EAppEventBusNames.HideDialogLoading, hideFn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowDialogLoading, showFn);
      appEventBus.off(EAppEventBusNames.HideDialogLoading, hideFn);
    };
  }, [getKey]);

  return (
    <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
      <DialogContainer
        key={visibilityState.key}
        open={visibilityState.visible}
        // ref={dialogRef}
        // onClose={buildForwardOnClose({ onClose })}
        // isExist={isExist}
        onClose={async () => {
          setVisibilityState({ visible: false, key: getKey() });
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
