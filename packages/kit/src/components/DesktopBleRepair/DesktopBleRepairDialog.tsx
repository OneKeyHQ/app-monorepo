import { useCallback, useEffect } from 'react';

import { Dialog, SizableText } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  useDesktopBleRepairActions,
  useDesktopBleRepairAtom,
} from '../../states/jotai/contexts/desktopBleRepair';

export function DesktopBleRepairDialog() {
  const [desktopBleRepairState] = useDesktopBleRepairAtom();
  const actions = useDesktopBleRepairActions();

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

  const handleRepair = useCallback(
    async ({ preventClose }: { preventClose?: () => void }) => {
      if (desktopBleRepairState.data) {
        const success = await actions.current.startDesktopBleRepair(
          desktopBleRepairState.data,
        );
        if (!success) {
          // Could show an error toast here
          console.warn('BLE repair failed');
          if (preventClose) {
            preventClose();
          }
        }
      }
    },
    [desktopBleRepairState.data, actions],
  );

  const handleCancel = useCallback(() => {
    actions.current.hideDesktopBleRepairDialog();
  }, [actions]);

  useEffect(() => {
    if (desktopBleRepairState.isVisible && desktopBleRepairState.data) {
      const deviceName =
        desktopBleRepairState.data.deviceName || 'OneKey Device';

      const getButtonText = () => {
        if (!desktopBleRepairState.isRepairing) {
          return 'Repair Connection';
        }
        switch (desktopBleRepairState.progressStage) {
          case 'searching':
            return 'Searching...';
          case 'matching':
            return 'Matching...';
          case 'connecting':
            return 'Connecting...';
          default:
            return 'Repairing...';
        }
      };

      Dialog.show({
        title: 'Bluetooth Connection Issue',
        description: `The Bluetooth connection for ${deviceName} needs to be repaired.`,
        renderContent: (
          <>
            <SizableText size="$bodyMd" color="$textSubdued" pb="$4">
              We will attempt to automatically find and reconnect your device.
              Please make sure your device is powered on and nearby.
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
        ),
        onClose: handleCancel,
      });
    }
  }, [
    desktopBleRepairState.isVisible,
    desktopBleRepairState.data,
    desktopBleRepairState.isRepairing,
    desktopBleRepairState.progressStage,
    desktopBleRepairState.progressMessage,
    handleRepair,
    handleCancel,
  ]);

  return null;
}
