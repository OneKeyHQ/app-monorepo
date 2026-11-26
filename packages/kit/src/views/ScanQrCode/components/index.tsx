import {
  forwardRef,
  useCallback,
  useEffect,
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
import {
  createMultiSymbolCoordinator,
  mapFramePointToCoverView,
} from '../utils/multiQrSymbols';

import { CameraSwitchButton } from './CameraSwitchButton';
import { MultiQrSelectionOverlay } from './MultiQrSelectionOverlay';
import { ScanCamera } from './ScanCamera';
import {
  effectiveCameraId,
  supportsDesktopQrCapture,
} from './ScanCamera/cameraChoice';
import { useScanCameraIsActive } from './ScanCamera/useScanCameraIsActive';
import { useScanCameras } from './ScanCamera/useScanCameras';

import type { IScanCameraRef } from './ScanCamera';
import type { IScanFocusRequest } from './ScanCamera/types';
import type {
  IDimensions2D,
  IMultiQrFrameEvent,
  IMultiQrSymbol,
  IMultiSymbolCommitResult,
  IMultiSymbolCoordinator,
  IPoint2D,
} from '../utils/multiQrSymbols';
import type { QrScannerErrorCode } from '@onekeyfe/react-native-qr-scanner/web';
import type { LayoutChangeEvent } from 'react-native';

export type IScanQrCodeProps = {
  /** `retry` asks the host to forget the frame it just handled, so the next
   * delivery of the same bytes reaches the handler again (a submit that
   * rejected; see createScannedFrameGate). */
  handleBarCodeScanned: (
    value: string,
  ) => Promise<{ progress?: number; retry?: boolean }>;
  qrWalletScene?: boolean;
  /** The album picker is covering the live selection. */
  selectionCovered?: boolean;
  /** DeviceStage's viewfinder has no screen route; keep its camera active. */
  disableNavigationGuard?: boolean;
};

export const ScanQrCode = forwardRef<IScanCameraRef, IScanQrCodeProps>(
  function ScanQrCode(
    {
      handleBarCodeScanned,
      qrWalletScene,
      selectionCovered,
      disableNavigationGuard,
    },
    ref,
  ) {
    const intl = useIntl();
    const frameGate = useRef(createScannedFrameGate());
    const [webFallback, setWebFallback] = useState(false);
    // Dedicated hardware-wallet UR flows stay on the single-symbol fast path.
    const supportsMultiSymbol = !qrWalletScene && !disableNavigationGuard;
    const usesNativeDesktopCamera =
      platformEnv.isDesktop &&
      !webFallback &&
      supportsDesktopQrCapture(
        globalThis.desktopApi?.qrScanner,
        supportsMultiSymbol,
      );
    const useWebCamera = platformEnv.isDesktop && !usesNativeDesktopCamera;
    const [cameraError, setCameraError] = useState<QrScannerErrorCode>();
    const [readyCamera, setReadyCamera] = useState<{
      id?: string;
      requestedId?: string;
      revision: number;
    }>();
    const cameraActive = useScanCameraIsActive(disableNavigationGuard);
    const {
      cameras,
      loaded: camerasLoaded,
      pending,
    } = useScanCameras(readyCamera?.revision ?? 0, useWebCamera, cameraActive);
    const cameraPreferenceKey = usesNativeDesktopCamera
      ? EAppSyncStorageKeys.last_scan_desktop_native_camera_id
      : EAppSyncStorageKeys.last_scan_camera_id;
    const [chosenCameraId, setChosenCameraId] = useState(
      () => appStorage.syncStorage.getString(cameraPreferenceKey) || undefined,
    );
    const cameraId = camerasLoaded
      ? effectiveCameraId(cameras, chosenCameraId)
      : chosenCameraId;
    const cameraIdRef = useRef(cameraId);
    cameraIdRef.current = cameraId;
    const onCameraReady = useCallback(
      (id?: string) => {
        const requestedId = cameraIdRef.current;
        const activeId = id || requestedId;
        setReadyCamera((previous) => ({
          id: activeId,
          requestedId,
          revision: (previous?.revision ?? 0) + 1,
        }));
        if (activeId) {
          void appStorage.syncStorage.set(cameraPreferenceKey, activeId);
        }
        setCameraError(undefined);
      },
      [cameraPreferenceKey],
    );
    const isFocused = useIsFocused();
    const [progress, setProgress] = useState<number | undefined>();
    const isHandlingFrame = useRef(false);
    const [multiSymbolEnabled, setMultiSymbolEnabled] =
      useState(supportsMultiSymbol);
    const [frozen, setFrozen] = useState(false);
    const [focusRequest, setFocusRequest] = useState<IScanFocusRequest>();
    const focusRequestId = useRef(0);
    const [selectingSymbols, setSelectingSymbols] = useState<IMultiQrSymbol[]>(
      [],
    );
    const viewSizeRef = useRef<IDimensions2D>({ width: 0, height: 0 });
    const coordinatorRef = useRef<IMultiSymbolCoordinator | null>(null);

    const onCameraLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      viewSizeRef.current = { width, height };
    }, []);

    useLayoutEffect(() => {
      setFocusRequest(undefined);
      coordinatorRef.current?.reset();
    }, [cameraActive, cameraId, isFocused, useWebCamera]);

    useLayoutEffect(() => {
      if (isFocused) frameGate.current.reset();
    }, [isFocused]);

    const reloadHandleBarCodeScanned = useCallback(
      async (data: string): Promise<IMultiSymbolCommitResult> => {
        if (isHandlingFrame.current) return 'ignored';
        if (!frameGate.current.admit(data)) return 'duplicate';

        isHandlingFrame.current = true;
        try {
          const { progress: progressValue, retry } =
            await handleBarCodeScanned(data);
          if (retry) {
            frameGate.current.release(data);
            return 'retry';
          }
          if (progressValue) {
            setProgress(progressValue);
            return progressValue >= 1 ? 'complete' : 'progress';
          }
          return 'ignored';
        } finally {
          isHandlingFrame.current = false;
        }
      },
      [handleBarCodeScanned],
    );

    const reloadHandleBarCodeScannedRef = useRef(reloadHandleBarCodeScanned);
    reloadHandleBarCodeScannedRef.current = reloadHandleBarCodeScanned;

    useEffect(() => {
      if (!supportsMultiSymbol) {
        coordinatorRef.current?.dispose();
        coordinatorRef.current = null;
        setMultiSymbolEnabled(false);
        setFrozen(false);
        setSelectingSymbols([]);
        return;
      }
      const coordinator = createMultiSymbolCoordinator({
        aggregationWindowMs: 140,
        onFrozenChange: setFrozen,
        onMultiSymbolChange: setMultiSymbolEnabled,
        onSelectingChange: setSelectingSymbols,
        onCommitText: (text) => reloadHandleBarCodeScannedRef.current(text),
      });
      coordinatorRef.current = coordinator;
      setMultiSymbolEnabled(true);
      return () => {
        coordinator.dispose();
        if (coordinatorRef.current === coordinator) {
          coordinatorRef.current = null;
        }
      };
    }, [supportsMultiSymbol]);

    const handleFrameText = useCallback(
      (text: string) => {
        if (supportsMultiSymbol) {
          coordinatorRef.current?.receiveFastPathText(text);
        } else {
          void reloadHandleBarCodeScanned(text);
        }
      },
      [reloadHandleBarCodeScanned, supportsMultiSymbol],
    );

    const handleFrameSymbols = useCallback(function receiveFrame(
      event: IMultiQrFrameEvent,
      finishVerification?: ReturnType<
        IMultiSymbolCoordinator['beginPreviewVerification']
      >,
    ): boolean | void {
      const coordinator = coordinatorRef.current;
      if (!coordinator) return;
      let symbols = event.symbols;
      if (event.coordinateSpace === 'frame') {
        const viewSize = viewSizeRef.current;
        const frameWidth = event.frameWidth ?? 0;
        const frameHeight = event.frameHeight ?? 0;
        if (!viewSize.width || !viewSize.height || !frameWidth || !frameHeight)
          return;
        symbols = symbols.map((sym) => {
          const pt = mapFramePointToCoverView(
            { x: sym.centerX, y: sym.centerY },
            { width: frameWidth, height: frameHeight },
            viewSize,
            false,
          );
          return { ...sym, centerX: pt.x, centerY: pt.y };
        });
      }
      if (finishVerification) return finishVerification(symbols);
      if (event.verifyPreview && coordinator.needsSelection(symbols)) {
        const finish = coordinator.beginPreviewVerification();
        void event
          .verifyPreview((verifiedFrame) => receiveFrame(verifiedFrame, finish))
          .then(
            () => finish(),
            () => finish(),
          );
        return;
      }
      return coordinator.receiveFrame(symbols);
    }, []);

    const handleSelectMultiSymbol = useCallback((symbol: IMultiQrSymbol) => {
      coordinatorRef.current?.selectSymbol(symbol);
    }, []);

    const handleCancelMultiSelection = useCallback(() => {
      coordinatorRef.current?.cancelSelection();
    }, []);

    const handlePreviewTap = useCallback(() => {
      coordinatorRef.current?.refocus();
    }, []);

    const handleRefocusSelection = useCallback(
      (point?: IPoint2D) => {
        handlePreviewTap();
        if (point) {
          focusRequestId.current += 1;
          setFocusRequest({ ...point, id: focusRequestId.current });
        }
      },
      [handlePreviewTap],
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
      !!readyCamera &&
      cameraId !== undefined &&
      cameraId !== readyCamera.requestedId;
    const onCameraError = useCallback(
      (code: QrScannerErrorCode) => {
        setCameraError(code);
        if (code === 'permission-denied' && !isSwitchingCamera) {
          showPermissionDeniedDialog();
        }
      },
      [isSwitchingCamera, showPermissionDeniedDialog],
    );

    const useWebFallback = useCallback(() => {
      setReadyCamera(undefined);
      setChosenCameraId(
        appStorage.syncStorage.getString(
          EAppSyncStorageKeys.last_scan_camera_id,
        ) || undefined,
      );
      setWebFallback(true);
    }, []);

    const retryCamera = useCallback(() => {
      setCameraError(undefined);
      setChosenCameraId(readyCamera?.id);
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
        onLayout={onCameraLayout}
        handleScanResult={handleFrameText}
        onFrameSymbols={supportsMultiSymbol ? handleFrameSymbols : undefined}
        multiSymbol={supportsMultiSymbol ? multiSymbolEnabled : false}
        frozen={supportsMultiSymbol ? frozen : false}
        focusRequest={focusRequest}
        onPreviewTap={supportsMultiSymbol ? handlePreviewTap : undefined}
        onCameraError={onCameraError}
        onCameraReady={onCameraReady}
        useWebCamera={useWebCamera}
        onWebCameraFallback={useWebFallback}
        cameraActive={cameraActive && !(usesNativeDesktopCamera && pending)}
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
        {selectingSymbols.length === 0 ? (
          <CameraSwitchButton
            cameras={cameras}
            cameraId={readyCamera?.id || cameraId}
            onSelect={setChosenCameraId}
            inlinePicker={disableNavigationGuard}
          />
        ) : null}
        {!selectionCovered ? (
          <MultiQrSelectionOverlay
            symbols={selectingSymbols}
            onSelect={handleSelectMultiSymbol}
            onCancel={handleCancelMultiSelection}
            onRefocus={handleRefocusSelection}
          />
        ) : null}
      </ScanCamera>
    );
  },
);
