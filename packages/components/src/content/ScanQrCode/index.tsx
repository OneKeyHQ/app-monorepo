import { useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { requestPermissionsAsync as requestCameraPermissionsAsync } from 'expo-barcode-scanner';
import { PermissionStatus } from 'expo-modules-core';

import { Stack, YStack } from '@onekeyhq/components';

import { ScanCamera } from './ScanCamera';

export type IScanQrCodeProps = {
  handleBarCodeScanned: (value: string) => void;
};

export function ScanQrCode({ handleBarCodeScanned }: IScanQrCodeProps) {
  const [currentPermission, setCurrentPermission] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED,
  );
  const isFocused = useIsFocused();

  useEffect(() => {
    void requestCameraPermissionsAsync().then(({ status }) =>
      setCurrentPermission(status),
    );
  }, []);

  if (currentPermission !== PermissionStatus.GRANTED) {
    return null;
  }
  return (
    <ScanCamera
      style={{
        flex: 1,
      }}
      isActive={isFocused}
      handleScanResult={handleBarCodeScanned}
    >
      <YStack
        fullscreen
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        <Stack
          borderWidth={400}
          borderColor="rgba(0,0,0,.5)"
          borderRadius={425}
        >
          <Stack w={256} h={256} borderRadius="$6" />
        </Stack>
      </YStack>
    </ScanCamera>
  );
}
