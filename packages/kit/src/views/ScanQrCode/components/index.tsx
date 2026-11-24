import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  BlurView,
  Button,
  Dialog,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import extUtils, { EXT_HTML_FILES } from '@onekeyhq/shared/src/utils/extUtils';
import {
  openSettings,
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { createScannedFrameGate } from '../../../provider/Container/DeviceStageContainer/airGapScanFrame';

import { CameraSwitchButton } from './CameraSwitchButton';
import { ScanCamera } from './ScanCamera';
import { effectiveCameraId } from './ScanCamera/cameraChoice';
import { useScanCameras } from './ScanCamera/useScanCameras';

import type { IScanCameraRef } from './ScanCamera';
import type { QrScannerErrorCode } from '@onekeyfe/react-native-qr-scanner/web';

export type IScanQrCodeProps = {
  /** `retry` asks the host to forget the frame it just handled, so the next
   * delivery of the same bytes reaches the handler again (a submit that
   * rejected; see createScannedFrameGate). */
  handleBarCodeScanned: (
    value: string,
  ) => Promise<{ progress?: number; retry?: boolean }>;
  qrWalletScene?: boolean;
  /** DeviceStage's viewfinder has no screen route; keep its camera active. */
  disableNavigationGuard?: boolean;
};

export const ScanQrCode = forwardRef<IScanCameraRef, IScanQrCodeProps>(
  function ScanQrCode(
    { handleBarCodeScanned, qrWalletScene, disableNavigationGuard },
    ref,
  ) {
    const intl = useIntl();
    const frameGate = useRef(createScannedFrameGate());
    const [cameraError, setCameraError] = useState<QrScannerErrorCode>();
    const [readyCamera, setReadyCamera] = useState<{
      id?: string;
      revision: number;
    }>();
    const { cameras, loaded: camerasLoaded } = useScanCameras(
      readyCamera?.revision ?? 0,
    );
    const [chosenCameraId, setChosenCameraId] = useState(
      () =>
        appStorage.syncStorage.getString(
          EAppSyncStorageKeys.last_scan_camera_id,
        ) || undefined,
    );
    const cameraId = camerasLoaded
      ? effectiveCameraId(cameras, chosenCameraId)
      : chosenCameraId;
    const onCameraReady = useCallback(
      (reportedId?: string) => {
        const id = platformEnv.isNative ? cameraId : reportedId;
        setReadyCamera((previous) => ({
          id,
          revision: (previous?.revision ?? 0) + 1,
        }));
        void appStorage.syncStorage.set(
          EAppSyncStorageKeys.last_scan_camera_id,
          id ?? '',
        );
        setCameraError(undefined);
      },
      [cameraId],
    );
    const isFocused = useIsFocused();
    const [progress, setProgress] = useState<number | undefined>();
    const isHandlingFrame = useRef(false);

    useLayoutEffect(() => {
      if (isFocused) frameGate.current.reset();
    }, [isFocused]);

    const reloadHandleBarCodeScanned = useCallback(
      async (data: string) => {
        if (isHandlingFrame.current || !frameGate.current.admit(data)) return;

        isHandlingFrame.current = true;
        try {
          const { progress: progressValue, retry } =
            await handleBarCodeScanned(data);
          if (retry) {
            frameGate.current.release(data);
          }
          if (progressValue) {
            setProgress(progressValue);
          }
        } finally {
          isHandlingFrame.current = false;
        }
      },
      [handleBarCodeScanned],
    );

    const showPermissionDeniedDialog = useCallback(() => {
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

    const isSwitchingCamera =
      !!readyCamera && cameraId !== undefined && cameraId !== readyCamera.id;
    const onCameraError = useCallback(
      (code: QrScannerErrorCode) => {
        setCameraError(code);
        if (code === 'permission-denied' && !isSwitchingCamera) {
          showPermissionDeniedDialog();
        }
      },
      [isSwitchingCamera, showPermissionDeniedDialog],
    );

    const retryCamera = useCallback(() => {
      setCameraError(undefined);
      if (readyCamera) setChosenCameraId(readyCamera.id);
    }, [readyCamera]);

    if (cameraError === 'permission-denied' && !isSwitchingCamera) return null;
    if (cameraError) {
      return (
        <YStack
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          bg="$bg"
        >
          <SizableText size="$bodyMd" textAlign="center">
            {intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
          </SizableText>
          <Button onPress={retryCamera} testID="scan-camera-retry">
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </YStack>
      );
    }

    return (
      <ScanCamera
        ref={ref}
        style={{
          flex: 1,
        }}
        handleScanResult={reloadHandleBarCodeScanned}
        onCameraError={onCameraError}
        onCameraReady={onCameraReady}
        cameraId={cameraId}
        disableNavigationGuard={disableNavigationGuard}
      >
        {qrWalletScene && !platformEnv.isNativeAndroid ? (
          <YStack fullscreen position="absolute" pointerEvents="none">
            <BlurView flex={1} contentStyle={{ flex: 1 }} />
          </YStack>
        ) : null}
        {progress ? (
          <YStack
            fullscreen
            justifyContent="flex-end"
            alignItems="flex-end"
            pointerEvents="none"
          >
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
        <CameraSwitchButton
          cameras={cameras}
          cameraId={readyCamera ? readyCamera.id : cameraId}
          onSelect={setChosenCameraId}
          inlinePicker={disableNavigationGuard}
        />
      </ScanCamera>
    );
  },
);
