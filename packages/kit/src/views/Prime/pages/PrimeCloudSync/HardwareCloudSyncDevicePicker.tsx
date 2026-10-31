import { useCallback } from 'react';

import { YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
  const connectDevice = useCallback(
    async (item: IConnectYourDeviceItem) => {
      // Scanned rows carry the SearchDevice the scan returned.
      const device = item.device as SearchDevice | undefined;
      if (!device?.connectId) return;
      await backgroundApiProxy.serviceHardware.connect({
        device,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        forceProtocolDetection: deviceUtils.isBluetoothSearchDevice(device),
      });
      await onPick(device.connectId);
    },
    [onPick],
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
    <YStack gap="$5">
      <ConnectDeviceChannels
        deviceTypeItems={ANY_DEVICE_TYPE}
        connectDevice={connectDevice}
        onWebDeviceConnected={onWebDeviceConnected}
        variant="dialog"
      />
    </YStack>
  );
}
