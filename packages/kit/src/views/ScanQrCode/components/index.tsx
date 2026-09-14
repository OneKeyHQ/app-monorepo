import { useCallback, useEffect, useRef, useState } from 'react';

import { Camera } from 'expo-camera';
import { PermissionStatus } from 'expo-modules-core';
import { useIntl } from 'react-intl';

import {
  BlurView,
  Dialog,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import {
  openSettings,
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { createScannedFrameGate } from '../../../provider/Container/DeviceStageContainer/airGapScanFrame';

import { ScanCamera } from './ScanCamera';

export type IScanQrCodeProps = {
  /** `retry` asks the host to forget the frame it just handled, so the next
   * delivery of the same bytes reaches the handler again (a submit that
   * rejected; see createScannedFrameGate). */
  handleBarCodeScanned: (
    value: string,
  ) => Promise<{ progress?: number; retry?: boolean }>;
  qrWalletScene?: boolean;
  /** Host is outside any screen (the DeviceStage viewfinder): skip the
   * native screen-removal guard, whose hooks throw without a route. */
  disableNavigationGuard?: boolean;
};

export function ScanQrCode({
  handleBarCodeScanned,
  qrWalletScene,
  disableNavigationGuard,
}: IScanQrCodeProps) {
  const intl = useIntl();
  const frameGate = useRef(createScannedFrameGate());
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
    frameGate.current.reset();
  }

  const reloadHandleBarCodeScanned = useCallback(
    async (data?: string | null) => {
      if (!frameGate.current.admit(data)) {
        return;
      }
      if (!handleBarCodeScanned || !data) {
        return;
      }
      const { progress: progressValue, retry } =
        await handleBarCodeScanned(data);
      if (retry) {
        frameGate.current.release(data);
      }
      if (progressValue) {
        setProgress(progressValue);
      }
    },
    [handleBarCodeScanned],
  );

  useEffect(
    () => () => {
      if (!frameGate.current.hasAdmittedAny()) {
        void handleBarCodeScanned?.('');
      }
    },
    [handleBarCodeScanned],
  );

  const handlePermission = useCallback(async () => {
    const readSilentStatus =
      platformEnv.isDesktopMac || platformEnv.isDesktopWin
        ? await globalThis.desktopApiProxy?.system?.getMediaAccessStatus?.(
            'camera',
          )
        : (await Camera.getCameraPermissionsAsync())?.status;
    if (readSilentStatus === PermissionStatus.GRANTED) {
      setCurrentPermission(PermissionStatus.GRANTED);
      return;
    }
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCurrentPermission(status);

    if (status === PermissionStatus.GRANTED) {
      return;
    }
    const canRequestExpandView =
      platformEnv.isExtension && !platformEnv.isExtensionUiExpandTab;
    const canViewTutorial =
      platformEnv.isRuntimeBrowser &&
      !platformEnv.isDesktop &&
      (platformEnv.isRuntimeChrome ||
        platformEnv.isRuntimeEdge ||
        platformEnv.isRuntimeBrave);
    const permissionConfirmText = canViewTutorial
      ? ETranslations.global_view_tutorial
      : ETranslations.global_go_settings;
    Dialog.show({
      tone: 'warning',
      icon: 'ErrorOutline',
      title: intl.formatMessage({
        id: ETranslations.scan_camera_access_denied,
      }),
      description: intl.formatMessage({
        id: canRequestExpandView
          ? ETranslations.scan_grant_camera_access_in_expand_view
          : ETranslations.scan_enable_camera_permissions,
      }),
      onConfirmText: intl.formatMessage({
        id: canRequestExpandView
          ? ETranslations.global_expand_view
          : permissionConfirmText,
      }),
      showCancelButton: true,
      showConfirmButton: true,
      onConfirm: () => {
        if (canRequestExpandView) {
          extUtils
            .openUrlInTab(EXT_HTML_FILES.uiExpandTab)
            .catch(console.error);
        } else {
          if (platformEnv.isRuntimeBrowser && !platformEnv.isDesktop) {
            if (platformEnv.isRuntimeChrome) {
              openUrlExternal(
                'https://support.google.com/chrome/answer/2693767',
              );
              return;
            }
            if (platformEnv.isRuntimeEdge) {
              openUrlExternal(
                'https://support.microsoft.com/zh-cn/windows/a83257bc-e990-d54a-d212-b5e41beba857',
              );
              return;
            }
            if (platformEnv.isRuntimeBrave) {
              openUrlExternal(
                'https://support.brave.com/hc/en-us/articles/360018205431',
              );
              return;
            }
          }
          openSettings('camera');
        }
      },
    });
  }, [intl]);

  useEffect(() => {
    void handlePermission();
  }, [handlePermission]);

  // const detected = !!(progress && progress > 0);
  return currentPermission === PermissionStatus.GRANTED ? (
    <ScanCamera
      style={{
        flex: 1,
      }}
      handleScanResult={reloadHandleBarCodeScanned}
      disableNavigationGuard={disableNavigationGuard}
    >
      {qrWalletScene ? (
        <>
          <YStack fullscreen position="absolute">
            {/* <ScanCorner direction="topLeft" detected={detected} />
            <ScanCorner direction="topRight" detected={detected} />
            <ScanCorner direction="bottomLeft" detected={detected} />
            <ScanCorner direction="bottomRight" detected={detected} />
            <Corner position="absolute" top="$5" left="$5" />
            <Corner position="absolute" top="$5" right="$5" />
            <Corner position="absolute" bottom="$5" left="$5" />
            <Corner position="absolute" bottom="$5" right="$5" /> */}
            {platformEnv.isNativeAndroid ? null : (
              <BlurView flex={1} contentStyle={{ flex: 1 }} />
            )}
          </YStack>
        </>
      ) : null}
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
            <SizableText
              size="$bodySmMedium"
              color="$whiteA12"
            >{`${intl.formatMessage({ id: ETranslations.scanning_text })} ${(
              progress * 100
            ).toFixed(0)}%`}</SizableText>
          </Stack>
        </YStack>
      ) : null}
    </ScanCamera>
  ) : null;
}
