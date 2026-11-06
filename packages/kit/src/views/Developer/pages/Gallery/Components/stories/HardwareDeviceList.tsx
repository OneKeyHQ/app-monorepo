import { useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  Button,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { FoundDevicesFooter } from '@onekeyhq/kit/src/views/Onboardingv2/components/FoundDevicesFooter';
import { ConnectionIndicator } from '@onekeyhq/kit/src/views/Onboardingv2/pages/ConnectionIndicator';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { IConnectYourDeviceItem } from '@onekeyhq/shared/types/device';

const MOCK_DEVICES: IConnectYourDeviceItem[] = Array.from(
  { length: 30 },
  (_, index) => {
    const id = `mock-ble-${String(index + 1).padStart(2, '0')}`;
    const name = `OneKey Pro ${String(index + 1).padStart(2, '0')}`;
    return {
      title: name,
      src: HwWalletAvatarImages.pro,
      device: {
        connectId: id,
        deviceId: null,
        uuid: id,
        name,
        deviceType: EDeviceType.Pro,
        commType: 'ble',
      },
    };
  },
);

// Use the Cloud sync picker's dialog and scan-result components without
// starting Bluetooth or sending a connection request to a real device.
export function HardwareDeviceList() {
  const [connectedDevice, setConnectedDevice] = useState('None');
  return (
    <YStack gap="$3">
      <XStack gap="$2" flexWrap="wrap">
        {[1, 3, 30].map((count) => (
          <Button
            key={count}
            testID={`hardware-device-list-mock-${count}`}
            onPress={() => {
              setConnectedDevice('None');
              const dialog = Dialog.show({
                title: 'Connect hardware wallet',
                showFooter: false,
                boundedSheetLayout: true,
                sheetDragArea: 'header',
                contentContainerProps: { pt: '$3', pb: '$5' },
                renderContent: (
                  <YStack gap="$4">
                    <ConnectionIndicator variant="dialog">
                      <ConnectionIndicator.Footer>
                        <FoundDevicesFooter
                          devices={MOCK_DEVICES.slice(0, count)}
                          isScanning
                          variant="dialog"
                          onConnect={async (item) => {
                            setConnectedDevice(item.device?.connectId ?? '');
                            await dialog.close();
                          }}
                        />
                      </ConnectionIndicator.Footer>
                    </ConnectionIndicator>
                  </YStack>
                ),
              });
            }}
          >
            {`${count} mock Bluetooth devices`}
          </Button>
        ))}
      </XStack>
      <SizableText testID="hardware-device-list-mock-result">
        {`Connected: ${connectedDevice}`}
      </SizableText>
    </YStack>
  );
}
