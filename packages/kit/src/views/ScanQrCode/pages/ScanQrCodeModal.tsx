import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  IconButton,
  Page,
  SizableText,
  Stack,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { NavCloseButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { glassBarItem } from '@onekeyhq/components/src/primitives/Button/GlassHeaderContext';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import PhotoLibrary from '@onekeyhq/shared/src/modules3rdParty/photo-library';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import { MultipleClickStack } from '../../../components/MultipleClickStack';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ScanQrCode } from '../components';
import { MultiQrSelectionOverlay } from '../components/MultiQrSelectionOverlay';
import { ScanQrCodeTestIDs } from '../testIDs';
import * as scanFromUrlModule from '../utils/scanFromURLAsync';

import type { IScanCameraRef } from '../components/ScanCamera';
import type { IMultiQrSymbol } from '../utils/multiQrSymbols';
import type { RouteProp } from '@react-navigation/core';
import type { LayoutChangeEvent } from 'react-native';

appGlobals.$$scanNavigation = undefined;

// Width kept for the hints beside the camera in the landscape layout.
const LANDSCAPE_HINTS_MIN_WIDTH = 260;

function DebugInput({
  onText,
  onClose,
}: {
  onText: (text: string) => void;
  onClose?: () => void;
}) {
  const navigation = useAppNavigation();
  const { bottom } = useSafeAreaInsets();
  appGlobals.$$scanNavigation = navigation;

  const [inputText, setInputText] = useState<string>(
    appStorage.syncStorage.getString(
      EAppSyncStorageKeys.last_scan_qr_code_text,
    ) || '',
  );
  const [visible, setVisible] = useState(false);

  if (visible) {
    return (
      <YStack pb={bottom}>
        <XStack>
          <IconButton
            onPress={onClose ?? (() => navigation.popStack())}
            icon="CrossedLargeOutline"
            variant="destructive"
            testID={ScanQrCodeTestIDs.debugCloseBtn}
          />
          <Stack flex={1} />
          <IconButton
            onPress={() => onText(inputText)}
            icon="CheckLargeOutline"
            testID={ScanQrCodeTestIDs.debugConfirmBtn}
          />
        </XStack>
        <XStack>
          <Stack flex={1}>
            <TextAreaInput
              value={inputText}
              onChangeText={setInputText}
              flex={1}
              placeholder="demo qrcode scan text"
              allowClear
              allowPaste
              testID={ScanQrCodeTestIDs.debugTextArea}
            />
          </Stack>
        </XStack>
      </YStack>
    );
  }
  return (
    <YStack pb={bottom}>
      <MultipleClickStack
        triggerAt={process.env.NODE_ENV === 'production' ? 10 : 3}
        showDevBgColor
        w="$8"
        h="$8"
        onPress={() => setVisible(true)}
      />
    </YStack>
  );
}

function ScanQrCodeModalFooter({
  qrWalletScene,
  showProTutorial,
}: {
  qrWalletScene?: boolean;
  showProTutorial?: boolean;
}) {
  const intl = useIntl();

  const FOOTER_NORMAL_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
    {
      icon: 'Copy3Outline',
      title: intl.formatMessage({
        id: ETranslations.scan_scan_address_codes_to_copy_address,
      }),
    },
    {
      icon: 'WalletconnectBrand',
      title: intl.formatMessage({
        id: ETranslations.scan_scan_walletconnect_code_to_connect_to_sites,
      }),
    },
  ];

  const FOOTER_TUTORIAL_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
    {
      icon: 'QrCodeOutline',
      title: intl.formatMessage({ id: ETranslations.scan_show_qr_code_steps }),
    },
  ];

  const FOOTER_SECURITY_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
    {
      icon: 'CameraExposureZoomInOutline',
      title: intl.formatMessage({
        id: ETranslations.scan_move_closer_if_scan_fails,
      }),
    },
    ...(platformEnv.isNativeAndroid
      ? []
      : ([
          {
            icon: 'ShieldCheckDoneOutline',
            title: intl.formatMessage({
              id: ETranslations.scan_screen_blurred_for_security,
            }),
          },
        ] as { title: string; icon: IKeyOfIcons }[])),
  ];

  const data = qrWalletScene
    ? [
        ...(showProTutorial ? FOOTER_TUTORIAL_ITEM_LIST : []),
        ...FOOTER_SECURITY_ITEM_LIST,
      ]
    : FOOTER_NORMAL_ITEM_LIST;

  return (
    <Stack
      w="100%"
      mx="auto"
      flex={1}
      $gtMd={{
        maxWidth: '$80',
      }}
      p="$5"
    >
      {data.map((item, index) => (
        <XStack
          key={index}
          {...(index !== 0
            ? {
                pt: '$4',
              }
            : null)}
        >
          <Stack
            $md={{
              pt: '$0.5',
            }}
          >
            <Icon name={item.icon} size="$5" color="$iconSubdued" />
          </Stack>
          <SizableText
            flex={1}
            pl="$4"
            size="$bodyLg"
            color="$textSubdued"
            $gtMd={{
              size: '$bodyMd',
            }}
          >
            {item.title}
          </SizableText>
        </XStack>
      ))}
    </Stack>
  );
}

export default function ScanQrCodeModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const scannerRef = useRef<IScanCameraRef>(null);
  const route =
    useRoute<
      RouteProp<
        IScanQrCodeModalParamList,
        EScanQrCodeModalPages.ScanQrCodeStack
      >
    >();
  const {
    callback: routeCallback,
    onCancel,
    qrWalletScene,
    showProTutorial,
  } = route.params;

  const routeNavigation = useNavigation();
  const scan = useRef<{
    mounted: boolean;
    phase: 'open' | 'result' | 'cancelled';
    captureVersion: number;
    animationReset?: Promise<void> | 'retry';
  }>({ mounted: false, phase: 'open', captureVersion: 0 });
  const cancelScan = useCallback(() => {
    if (scan.current.phase !== 'open') return;
    scan.current.phase = 'cancelled';
    onCancel();
  }, [onCancel]);

  useLayoutEffect(() => {
    const session = scan.current;
    session.mounted = true;
    const unsubscribe = routeNavigation.addListener('beforeRemove', cancelScan);
    return () => {
      session.mounted = false;
      unsubscribe();
      // Also handle teardown outside a navigation action, after effect replay.
      queueMicrotask(() => {
        if (!session.mounted) cancelScan();
      });
    };
  }, [cancelScan, routeNavigation]);

  const closeScanner = useCallback(() => {
    scannerRef.current?.dispose();
    cancelScan();
    navigation.popStack();
  }, [cancelScan, navigation]);

  const onResetAnimationData = useCallback((drain?: Promise<void>) => {
    const session = scan.current;
    const pending = session.animationReset;
    if (pending !== undefined && pending !== 'retry') return pending;
    if (!session.mounted || session.phase !== 'open') {
      return drain ?? Promise.resolve();
    }
    if (drain !== undefined) session.captureVersion += 1;
    else if (pending !== 'retry') return Promise.resolve();

    const reset = (drain ?? Promise.resolve())
      .then(async () => {
        if (session.mounted && session.phase === 'open') {
          await backgroundApiProxy.serviceScanQRCode.resetAnimationData();
        }
      })
      .then(
        () => {
          session.animationReset = undefined;
        },
        (error: unknown) => {
          session.animationReset = 'retry';
          throw error;
        },
      );
    session.animationReset = reset;
    return reset;
  }, []);

  const callback = useCallback(
    async (value: string, isCaptureCurrent?: () => boolean) => {
      const session = scan.current;
      const canDispatch = () =>
        session.phase === 'open' &&
        session.mounted &&
        isCaptureCurrent?.() !== false;
      if (!value || !canDispatch()) return {};
      if (process.env.NODE_ENV !== 'production') {
        await appStorage.syncStorage.set(
          EAppSyncStorageKeys.last_scan_qr_code_text,
          value,
        );
        if (!canDispatch()) return {};
      }
      let retriedReset = false;
      while (session.animationReset !== undefined) {
        const pending = session.animationReset;
        if (pending === 'retry') {
          if (retriedReset) return { retry: true };
          retriedReset = true;
        }
        try {
          await (pending === 'retry' ? onResetAnimationData() : pending);
        } catch {
          if (retriedReset) return { retry: true };
        }
        if (!canDispatch()) return {};
      }

      return routeCallback({
        value,
        popNavigation: true,
        routeKey: route.key,
        isCaptureCurrent,
        onResultDismiss: () => {
          if (!canDispatch()) return false;
          session.phase = 'result';
          return true;
        },
      });
    },
    [onResetAnimationData, route.key, routeCallback],
  );

  const isPhotoScanInProgress = useRef(false);
  const [pickedImageSelection, setPickedImageSelection] = useState<{
    uri: string;
    width: number;
    height: number;
    symbols: IMultiQrSymbol[];
  } | null>(null);
  const pickedImageUriRef = useRef<string | null>(null);

  const clearPickedImageSelection = useCallback(() => {
    const uri = pickedImageUriRef.current;
    pickedImageUriRef.current = null;
    setPickedImageSelection(null);
    if (uri) {
      void PhotoLibrary.releasePickedImage(uri).catch(() => {});
    }
  }, []);

  useLayoutEffect(
    () => () => {
      clearPickedImageSelection();
    },
    [clearPickedImageSelection],
  );

  const pickImage = useCallback(async () => {
    if (isPhotoScanInProgress.current) return;

    clearPickedImageSelection();
    isPhotoScanInProgress.current = true;
    try {
      const result = await PhotoLibrary.pickImage().catch(() => {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
        return { canceled: true } as const;
      });
      if (result.canceled) return;

      const uri = result.uri;
      let decoded = {
        width: 0,
        height: 0,
        symbols: [] as IMultiQrSymbol[],
        partial: undefined as boolean | undefined,
      };
      try {
        if (typeof scanFromUrlModule.scanSymbolsFromURLAsync === 'function') {
          const res = await scanFromUrlModule.scanSymbolsFromURLAsync(uri);
          decoded = {
            width: res.width,
            height: res.height,
            symbols: res.symbols,
            partial: res.partial,
          };
        } else {
          const text = await scanFromUrlModule.scanFromURLAsync(uri);
          decoded = {
            width: 0,
            height: 0,
            symbols: text ? [{ text, centerX: 0.5, centerY: 0.5 }] : [],
            partial: undefined,
          };
        }
      } catch {
        decoded = { width: 0, height: 0, symbols: [], partial: undefined };
      }

      if (decoded.symbols.length === 0) {
        await PhotoLibrary.releasePickedImage(uri).catch(() => {});
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.scan_no_recognizable_qr_code_found,
          }),
        });
        return;
      }

      if (decoded.symbols.length === 1 && !decoded.partial) {
        await PhotoLibrary.releasePickedImage(uri).catch(() => {});
        await callback(decoded.symbols[0].text);
        return;
      }

      // Multiple QR codes (or partial fallback result): keep image displayed
      // with green dot anchors until the user selects one or cancels.
      if (!scan.current.mounted || scan.current.phase !== 'open') {
        await PhotoLibrary.releasePickedImage(uri).catch(() => {});
        return;
      }
      pickedImageUriRef.current = uri;
      setPickedImageSelection({
        uri,
        width: decoded.width,
        height: decoded.height,
        symbols: decoded.symbols,
      });
    } finally {
      isPhotoScanInProgress.current = false;
    }
  }, [callback, clearPickedImageSelection, intl]);

  const handlePickedSymbolSelect = useCallback(
    (symbol: IMultiQrSymbol) => {
      if (isPhotoScanInProgress.current || !pickedImageUriRef.current) return;
      isPhotoScanInProgress.current = true;
      clearPickedImageSelection();
      void callback(symbol.text).finally(() => {
        isPhotoScanInProgress.current = false;
      });
    },
    [callback, clearPickedImageSelection],
  );

  const onCameraScanned = useCallback(
    async (value: string) => {
      if (isPhotoScanInProgress.current || pickedImageUriRef.current) {
        return { retry: true };
      }
      defaultLogger.scanQrCode.readQrCode.readFromCamera(value);
      const captureVersion = scan.current.captureVersion;
      return callback(
        value,
        () => captureVersion === scan.current.captureVersion,
      );
    },
    [callback],
  );

  // A phone sheet wider than it is tall (iPhone Duo inner display in
  // landscape) can't fit a full-width square camera above the hints, so
  // put the hints beside it and fit the camera to the remaining space.
  const media = useMedia();
  const [bodySize, setBodySize] = useState<{ width: number; height: number }>();
  const onBodyLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBodySize((prev) =>
      prev?.width === width && prev?.height === height
        ? prev
        : { width, height },
    );
  }, []);
  const landscapeCameraSize = bodySize
    ? Math.min(bodySize.height, bodySize.width - LANDSCAPE_HINTS_MIN_WIDTH)
    : 0;
  const isLandscapeLayout = Boolean(
    platformEnv.isNative &&
    media.md &&
    bodySize &&
    bodySize.width > bodySize.height,
  );

  const headerRightCall = useCallback(
    () =>
      qrWalletScene ? null : (
        <HeaderIconButton
          onPress={pickImage}
          // A leading web press keeps the picker in the browser's user gesture.
          onPressDebounce={platformEnv.isNative ? undefined : 1}
          icon="ImageSquareMountainOutline"
          testID={ScanQrCodeTestIDs.openPhotoBtn}
          title={intl.formatMessage({ id: ETranslations.scan_select_a_photo })}
        />
      ),
    [intl, pickImage, qrWalletScene],
  );

  const headerLeftCall = useCallback(
    () => <NavCloseButton onPress={closeScanner} />,
    [closeScanner],
  );
  const glassHeaderLeftItems = useCallback(
    () => [glassBarItem(<NavCloseButton onPress={closeScanner} />)],
    [closeScanner],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        headerLeft={platformEnv.isNative ? headerLeftCall : undefined}
        unstable_headerLeftItems={
          platformEnv.isNativeIOS26Plus ? glassHeaderLeftItems : undefined
        }
        headerRight={headerRightCall}
      />
      <Page.Body
        $gtMd={{ jc: 'center' }}
        flexDirection={isLandscapeLayout ? 'row' : 'column'}
        onLayout={onBodyLayout}
      >
        <Stack
          w={isLandscapeLayout ? landscapeCameraSize : '100%'}
          mx="auto"
          $gtMd={{
            maxWidth: '$80',
          }}
        >
          <Stack w="100%" pb="100%">
            <YStack fullscreen p="$5">
              <Stack
                w="100%"
                h="100%"
                borderRadius="$6"
                $gtMd={{
                  borderRadius: '$3',
                }}
                borderCurve="continuous"
                overflow="hidden"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderSubdued"
                // the filter property used for overflow-hidden work on web
                style={{
                  filter: 'blur(0px)',
                }}
              >
                <ScanQrCode
                  ref={scannerRef}
                  handleBarCodeScanned={onCameraScanned}
                  onResetAnimationData={onResetAnimationData}
                  qrWalletScene={qrWalletScene}
                  selectionCovered={Boolean(pickedImageSelection)}
                />
                {pickedImageSelection ? (
                  <MultiQrSelectionOverlay
                    imageUri={pickedImageSelection.uri}
                    imageSize={{
                      width: pickedImageSelection.width,
                      height: pickedImageSelection.height,
                    }}
                    symbols={pickedImageSelection.symbols}
                    onSelect={handlePickedSymbolSelect}
                    onCancel={clearPickedImageSelection}
                  />
                ) : null}
              </Stack>
            </YStack>
          </Stack>
        </Stack>
        <Stack flex={1}>
          <ScanQrCodeModalFooter
            qrWalletScene={qrWalletScene}
            showProTutorial={showProTutorial}
          />
        </Stack>
      </Page.Body>
      <Page.Footer safeAreaBottomMode="content">
        <DebugInput
          onText={(value) => callback(value)}
          onClose={platformEnv.isNative ? closeScanner : undefined}
        />
      </Page.Footer>
    </Page>
  );
}
