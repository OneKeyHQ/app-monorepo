import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { requestPermissionsAsync as requestCameraPermissionsAsync } from 'expo-barcode-scanner';
import { PermissionStatus } from 'expo-modules-core';
import { useIntl } from 'react-intl';

import { Dialog, Stack, YStack } from '@onekeyhq/components';
import { openSettings } from '@onekeyhq/kit/src/utils/openUrl';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';

import { ScanCamera } from './ScanCamera';

export type IScanQrCodeProps = {
  handleBarCodeScanned: (value: string) => void;
};

export function ScanQrCode({ handleBarCodeScanned }: IScanQrCodeProps) {
  const intl = useIntl();
  const scanned = useRef(false);
  const [currentPermission, setCurrentPermission] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED,
  );
  const isFocused = useIsFocused();
  if (isFocused) {
    scanned.current = false;
  }

  const reloadHandleBarCodeScanned = useCallback(
    (data?: string | null) => {
      if (scanned.current || !data) {
        return;
      }
      scanned.current = true;
      handleBarCodeScanned?.(data);
    },
    [handleBarCodeScanned],
  );

  useEffect(() => {
    void requestCameraPermissionsAsync().then(({ status }) => {
      if (status !== PermissionStatus.GRANTED) {
        const { isExtensionUiPopup } = platformEnv;
        Dialog.show({
          tone: 'warning',
          icon: 'ErrorOutline',
          title: intl.formatMessage({ id: 'modal__camera_access_not_granted' }),
          description: intl.formatMessage({
            id: isExtensionUiPopup
              ? 'msg__approving_camera_permission_needs_to_be_turned_on_in_expand_view'
              : 'modal__camera_access_not_granted_desc',
          }),
          onConfirmText: intl.formatMessage({
            id: isExtensionUiPopup
              ? 'form__expand_view'
              : 'action__go_to_settings',
          }),
          showCancelButton: true,
          showConfirmButton: true,
          onConfirm: () => {
            if (isExtensionUiPopup) {
              extUtils
                .openUrlInTab(EXT_HTML_FILES.uiExpandTab)
                .catch(console.error);
            } else {
              openSettings('camera');
            }
          },
        });
      }
      setCurrentPermission(status);
    });
  }, [intl]);
  return currentPermission === PermissionStatus.GRANTED ? (
    <ScanCamera
      style={{
        flex: 1,
      }}
      isActive={isFocused}
      handleScanResult={reloadHandleBarCodeScanned}
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
  ) : null;
}
