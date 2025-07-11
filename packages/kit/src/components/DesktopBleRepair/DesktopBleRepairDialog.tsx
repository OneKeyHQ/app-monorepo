import { useCallback, useEffect, useRef } from 'react';

import { Dialog, SizableText } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  ProviderJotaiContextDesktopBleRepair,
  useDesktopBleRepairActions,
  useDesktopBleRepairAtom,
  useDesktopBleRepairContextData,
} from '../../states/jotai/contexts/desktopBleRepair';

import type { IDesktopBleRepairData } from '../../states/jotai/contexts/desktopBleRepair';

// DialogContentWithState component that uses hooks internally
function DialogContentWithState({ data }: { data: IDesktopBleRepairData }) {
  const [desktopBleRepairState] = useDesktopBleRepairAtom();
  const actions = useDesktopBleRepairActions();

  const handleRepair = useCallback(
    async ({ preventClose }: { preventClose?: () => void }) => {
      if (data) {
        const success = await actions.current.startDesktopBleRepair(data);
        if (!success) {
          console.warn('BLE repair failed');
          if (preventClose) {
            preventClose();
          }
        }
      }
    },
    [data, actions],
  );

  const handleCancel = useCallback(() => {
    void actions.current.hideDesktopBleRepairDialog();
  }, [actions]);

  const getButtonText = () => {
    if (!desktopBleRepairState.isRepairing) {
      return 'Start Pairing';
    }
    switch (desktopBleRepairState.progressStage) {
      case 'searching':
        return 'Searching Device...';
      case 'matching':
        return 'Pairing Device...';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Pairing...';
    }
  };

  return (
    <>
      <SizableText size="$bodyMd" color="$textSubdued" pb="$4">
        We will search for your device and complete the Bluetooth pairing
        automatically. Please ensure your device is powered on and nearby.
      </SizableText>

      {desktopBleRepairState.progressMessage ? (
        <SizableText size="$bodyMd" color="$textSubdued" pb="$4">
          {desktopBleRepairState.progressMessage}
        </SizableText>
      ) : null}

      <Dialog.Footer
        showCancelButton
        onCancel={handleCancel}
        onCancelText="Cancel"
        onConfirm={handleRepair}
        onConfirmText={getButtonText()}
        confirmButtonProps={{
          disabled: desktopBleRepairState.isRepairing,
        }}
      />
    </>
  );
}

export function DesktopBleRepairDialog() {
  const [desktopBleRepairState] = useDesktopBleRepairAtom();
  const actions = useDesktopBleRepairActions();
  const contextData = useDesktopBleRepairContextData();
  const dialogInstanceRef = useRef<ReturnType<typeof Dialog.show> | null>(null);

  // Listen to DesktopBleRepairProgress events and update state
  useEffect(() => {
    const handleDesktopBleRepairProgress = (payload: {
      stage: string;
      message: string;
    }) => {
      actions.current.updateDesktopBleRepairProgress({
        progressStage: payload.stage as
          | 'searching'
          | 'matching'
          | 'connecting'
          | 'success'
          | 'failed',
        progressMessage: payload.message,
      });
    };

    appEventBus.on(
      EAppEventBusNames.DesktopBleRepairProgress,
      handleDesktopBleRepairProgress,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.DesktopBleRepairProgress,
        handleDesktopBleRepairProgress,
      );
    };
  }, [actions]);

  const handleCancel = useCallback(() => {
    void actions.current.hideDesktopBleRepairDialog();
    if (dialogInstanceRef.current) {
      void dialogInstanceRef.current.close();
      dialogInstanceRef.current = null;
    }
  }, [actions]);

  // Show dialog only when isVisible becomes true
  useEffect(() => {
    if (
      desktopBleRepairState.isVisible &&
      desktopBleRepairState.data &&
      !dialogInstanceRef.current
    ) {
      const deviceName =
        desktopBleRepairState.data.deviceName || 'OneKey Device';

      dialogInstanceRef.current = Dialog.show({
        title: 'Bluetooth Pairing Required',
        description: `${deviceName} needs to be paired with this computer for the first time.`,
        renderContent: (
          <ProviderJotaiContextDesktopBleRepair store={contextData.store}>
            <DialogContentWithState data={desktopBleRepairState.data} />
          </ProviderJotaiContextDesktopBleRepair>
        ),
        onClose: handleCancel,
      });
    }
  }, [
    desktopBleRepairState.isVisible,
    desktopBleRepairState.data,
    handleCancel,
    contextData.store,
  ]);

  // Clean up dialog when it becomes invisible
  useEffect(() => {
    if (!desktopBleRepairState.isVisible && dialogInstanceRef.current) {
      void dialogInstanceRef.current.close();
      dialogInstanceRef.current = null;
    }
  }, [desktopBleRepairState.isVisible]);

  return null;
}
