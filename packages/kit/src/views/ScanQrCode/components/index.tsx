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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ScanCamera } from './ScanCamera';

export type IScanQrCodeProps = {
  handleBarCodeScanned: (value: string) => Promise<{ progress?: number }>;
  qrWalletScene?: boolean;
};

export function ScanQrCode({
  handleBarCodeScanned,
  qrWalletScene,
}: IScanQrCodeProps) {
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
          title: intl.formatMessage({
            id: ETranslations.scan_camera_access_denied,
          }),
          description: intl.formatMessage({
            id: isExtensionUiPopup
              ? ETranslations.scan_grant_camera_access_in_expand_view
              : ETranslations.scan_enable_camera_permissions,
          }),
          onConfirmText: intl.formatMessage({
            id: isExtensionUiPopup
              ? ETranslations.global_expand_view
              : ETranslations.global_go_to_settings,
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
    <Stack flex={1}>
      <ScanCamera
        style={{
          flex: 1,
        }}
        isActive={isFocused}
        handleScanResult={reloadHandleBarCodeScanned}
      >
        {progress ? (
          <YStack fullscreen justifyContent="flex-end" alignItems="flex-end">
            <Stack
              bg="$blackA9"
              borderRadius="$2"
              mr="$3"
              mb="$3"
              px="$2"
              py="$1"
            >
              <SizableText size="$bodySmMedium" color="$whiteA12">{`Scanning ${(
                progress * 100
              ).toFixed(0)}%`}</SizableText>
            </Stack>
          </YStack>
        ) : null}
      </ScanCamera>
      {qrWalletScene ? (
        <YStack fullscreen>
          <BlurView flex={1} contentStyle={{ flex: 1 }} />
        </YStack>
      ) : null}
    </Stack>
  ) : null;
}
