import { useCallback } from 'react';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDeviceStageBurst } from '@onekeyhq/kit/src/hooks/useDeviceStageBurst';
import { ConnectDeviceChannels } from '@onekeyhq/kit/src/views/Onboardingv2/pages/ConnectYourDevice';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { EDeviceType } from '@onekeyfe/hd-shared';

// Any OneKey model can hold the standard wallet.
const ANY_DEVICE_TYPE: EDeviceType[] = [];

// Onboarding's connect window laid out as dialog content. It hands the device's
// connectId back without creating a wallet; the Cloud key reads the standard
// wallet from the device itself.
export function HardwareCloudSyncDevicePicker({
  onPick,
}: {
  onPick: (connectId: string) => Promise<void> | void;
}) {
  const { beginBurst, endBurst } = useDeviceStageBurst();
  const connectDevice = useCallback(
    async (item: IConnectYourDeviceItem) => {
      // Scanned rows carry the SearchDevice the scan returned.
      const device = item.device as SearchDevice | undefined;
      if (!device?.connectId) return;
      let connectionError: unknown;
      try {
        await beginBurst({
          connectId: device.connectId,
          deviceType: device.deviceType,
          deviceName: device.name,
          deviceColor: deviceUtils.getDeviceColorFromSearchDevice(device),
        });
        await backgroundApiProxy.serviceHardware.connect({
          device,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          forceProtocolDetection: deviceUtils.isBluetoothSearchDevice(device),
        });
      } catch (error) {
        connectionError = error;
        throw error;
      } finally {
        // Onboarding's shared stage owns connection errors, including those
        // muted for toasts. Settle it before onPick can dismiss this picker.
        await endBurst({ error: connectionError });
      }
      await onPick(device.connectId);
    },
    [beginBurst, endBurst, onPick],
  );
  const onWebDeviceConnected = useCallback(
    async (deviceData: Pick<IConnectYourDeviceItem, 'device'>) => {
      if (deviceData.device?.connectId) {
        await onPick(deviceData.device.connectId);
      }
    },
    [onPick],
  );
  return (
    <YStack
      testID="hardware-cloud-sync-device-picker"
      collapsable={false}
      gap="$4"
    >
      <ConnectDeviceChannels
        deviceTypeItems={ANY_DEVICE_TYPE}
        connectDevice={connectDevice}
        onWebDeviceConnected={onWebDeviceConnected}
        variant="dialog"
      />
    </YStack>
  );
}
