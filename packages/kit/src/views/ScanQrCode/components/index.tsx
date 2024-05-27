import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { requestPermissionsAsync as requestCameraPermissionsAsync } from 'expo-barcode-scanner';
import { PermissionStatus } from 'expo-modules-core';
import { useIntl } from 'react-intl';

import {
  BlurView,
  Dialog,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ScanCamera } from './ScanCamera';

export type IScanQrCodeProps = {
  handleBarCodeScanned: (value: string) => Promise<{ progress?: number }>;
  mask?: boolean;
};

export function ScanQrCode({ handleBarCodeScanned, mask }: IScanQrCodeProps) {
  const intl = useIntl();
  const scanned = useRef<string | undefined>(undefined);
  const [currentPermission, setCurrentPermission] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED,
  );
  const isFocused = useIsFocused();
  const [progress, setProgress] = useState<number | undefined>();
  /*
    useEffect has been removed for performance. 
    If other hooks cause scanned to be refreshed to false, please add useEffect back.
  */
  if (isFocused) {
    scanned.current = undefined;
  }

  const reloadHandleBarCodeScanned = useCallback(
    async (data?: string | null) => {
      if (!data) {
        return;
      }
      if (scanned.current === data) {
        return;
      }
      scanned.current = data;
      if (!handleBarCodeScanned) {
        return;
      }
      const { progress: progressValue } = await handleBarCodeScanned(data);
      if (progressValue) {
        setProgress(progressValue);
      }
    },
    [handleBarCodeScanned],
  );

  useEffect(
    () => () => {
      if (!scanned.current) {
        void handleBarCodeScanned?.('');
      }
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
          {mask ? (
            <YStack fullscreen>
              <BlurView flex={1} borderRadius="$6" />
            </YStack>
          ) : null}
          {progress ? (
            <YStack fullscreen justifyContent="flex-end" alignItems="flex-end">
              <Stack bg="white" borderRadius="$1" px="$3" py="$2">
                <SizableText size="$headingXxs" color="black">{`${(
                  progress * 100
                ).toFixed(2)}%`}</SizableText>
              </Stack>
            </YStack>
          ) : null}
        </Stack>
      </YStack>
    </ScanCamera>
  ) : null;
}
