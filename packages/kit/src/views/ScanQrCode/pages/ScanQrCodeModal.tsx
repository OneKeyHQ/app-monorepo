import { useCallback, useEffect, useRef, useState } from 'react';

import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/core';
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
  rootNavigationRef,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { NavCloseButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { glassBarItem } from '@onekeyhq/components/src/primitives/Button/GlassHeaderContext';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
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
import { ScanQrCodeTestIDs } from '../testIDs';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import type { IScanCameraRef } from '../components/ScanCamera';
import type { RouteProp } from '@react-navigation/core';
import type { LayoutChangeEvent } from 'react-native';

appGlobals.$$scanNavigation = undefined;

// Width kept for the hints beside the camera in the landscape layout.
const LANDSCAPE_HINTS_MIN_WIDTH = 260;

type IScanNavigationState = {
  routes: readonly { key?: string; state?: IScanNavigationState }[];
};

function hasRouteKey(
  state: IScanNavigationState | undefined,
  key: string,
): boolean {
  return (
    state?.routes.some(
      (route) => route.key === key || hasRouteKey(route.state, key),
    ) ?? false
  );
}

function DebugInput({
  onText,
  onClose,
}: {
  onText: (text: string) => void;
  onClose: () => void;
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
            onPress={onClose}
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
        testID={ScanQrCodeTestIDs.debugTrigger}
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
  const reactNavigation = useNavigation();
  const scannerRef = useRef<IScanCameraRef>(null);
  const scanScope = useRef<AbortController | null>(null);
  const childScanScope = useRef<{
    controller: AbortController;
    released: boolean;
  } | null>(null);
  const isFocused = useRef(false);
  const scanGeneration = useRef(0);
  const photoAttemptId = useRef(0);
  const handoffOwner = useRef<symbol | undefined>(undefined);
  const exitReason = useRef<'result' | 'cancelled' | undefined>(undefined);
  const route =
    useRoute<
      RouteProp<
        IScanQrCodeModalParamList,
        EScanQrCodeModalPages.ScanQrCodeStack
      >
    >();
  const {
    callback: routeCallback,
    qrWalletScene,
    showProTutorial,
  } = route.params;
  const photoRetryToastId = `${route.key}:photo-retry`;
  useFocusEffect(
    useCallback(() => {
      const retained = childScanScope.current;
      const controller = retained?.controller ?? new AbortController();
      scanScope.current = controller;
      isFocused.current = true;
      if (retained?.released) childScanScope.current = null;
      return () => {
        isFocused.current = false;
        if (childScanScope.current?.controller !== controller) {
          controller.abort();
        }
        Toast.dismiss(photoRetryToastId);
      };
    }, [photoRetryToastId]),
  );

  const isScanOpen = useCallback(
    () => hasRouteKey(rootNavigationRef.current?.getRootState(), route.key),
    [route.key],
  );
  const onResultWillClose = useCallback(() => {
    exitReason.current = 'result';
  }, []);
  const cancelScan = useCallback(() => {
    if (exitReason.current) return;
    exitReason.current = 'cancelled';
    scanScope.current?.abort();
    childScanScope.current = null;
    Toast.dismiss(photoRetryToastId);
    void routeCallback({
      value: '',
      popNavigation: false,
    });
  }, [photoRetryToastId, routeCallback]);

  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', cancelScan);
    return () => {
      unsubscribe();
      if (!isScanOpen()) cancelScan();
    };
  }, [cancelScan, isScanOpen, reactNavigation]);

  const isScanActive = useCallback(
    (signal: AbortSignal | undefined) =>
      !exitReason.current &&
      signal?.aborted === false &&
      scanScope.current?.signal === signal &&
      rootNavigationRef.current?.getCurrentRoute()?.key === route.key,
    [route.key],
  );
  const callback = useCallback(
    async (
      value: string,
      signal = scanScope.current?.signal,
      generation = scanGeneration.current,
    ) => {
      const resultOwner = Symbol('scan result');
      let resultGeneration = generation;
      const canApplyScanResult = () =>
        isScanActive(signal) &&
        resultGeneration === scanGeneration.current &&
        (!handoffOwner.current || handoffOwner.current === resultOwner);
      if (value && !canApplyScanResult()) {
        return { retry: true };
      }
      if (process.env.NODE_ENV !== 'production') {
        if (value) {
          await appStorage.syncStorage.set(
            EAppSyncStorageKeys.last_scan_qr_code_text,
            value,
          );
        }
      }

      const holdForChildScan = () => {
        const controller = scanScope.current;
        if (!controller || childScanScope.current || !canApplyScanResult()) {
          throw new OneKeyErrorScanQrCodeCancel();
        }
        const retained = { controller, released: false };
        childScanScope.current = retained;
        handoffOwner.current = resultOwner;
        scanGeneration.current += 1;
        photoAttemptId.current += 1;
        resultGeneration = scanGeneration.current;
        return () => {
          if (childScanScope.current !== retained) return;
          if (isFocused.current) {
            childScanScope.current = null;
          } else {
            // A child can finish before the navigator restores parent focus.
            retained.released = true;
          }
        };
      };
      try {
        return await routeCallback({
          value,
          popNavigation: true,
          canApplyScanResult,
          scanSignal: signal,
          holdForChildScan,
          isScanOpen,
          onResultWillClose,
        });
      } finally {
        if (handoffOwner.current === resultOwner) {
          handoffOwner.current = undefined;
        }
      }
    },
    [isScanActive, isScanOpen, onResultWillClose, routeCallback],
  );

  const closeScanner = useCallback(() => {
    if (exitReason.current === 'cancelled' || !isScanOpen()) return;
    scannerRef.current?.dispose();
    cancelScan();
    navigation.popStack();
  }, [cancelScan, isScanOpen, navigation]);

  const isPickingImage = useRef(false);
  const submitPhoto = useCallback(
    async function submitPhoto(
      data: string,
      signal: AbortSignal | undefined,
      attemptId: number,
      generation: number,
    ) {
      const canRetry = () =>
        photoAttemptId.current === attemptId &&
        !handoffOwner.current &&
        isScanActive(signal);
      const { retry } = await callback(data, signal, generation);
      if (!retry || scanGeneration.current !== generation || !canRetry())
        return;

      Toast.error({
        toastId: photoRetryToastId,
        title: intl.formatMessage({ id: ETranslations.global_server_error }),
        actions: {
          label: intl.formatMessage({ id: ETranslations.global_try_again }),
          onPress: async () => {
            if (isPickingImage.current || !canRetry()) return;
            isPickingImage.current = true;
            scanGeneration.current += 1;
            photoAttemptId.current += 1;
            Toast.dismiss(photoRetryToastId);
            try {
              await submitPhoto(
                data,
                signal,
                photoAttemptId.current,
                scanGeneration.current,
              );
            } finally {
              isPickingImage.current = false;
            }
          },
        },
      });
    },
    [callback, intl, isScanActive, photoRetryToastId],
  );

  const pickImage = useCallback(async () => {
    const signal = scanScope.current?.signal;
    if (
      isPickingImage.current ||
      handoffOwner.current ||
      !isScanActive(signal)
    ) {
      return;
    }
    isPickingImage.current = true;
    scanGeneration.current += 1;
    const generation = scanGeneration.current;
    try {
      const result = await PhotoLibrary.pickImage();
      if (result.canceled) return;

      photoAttemptId.current += 1;
      const attemptId = photoAttemptId.current;
      Toast.dismiss(photoRetryToastId);
      const { uri } = result;
      let data: string | null = null;
      try {
        data = await scanFromURLAsync(uri);
      } catch {
        data = null;
      } finally {
        await PhotoLibrary.releasePickedImage(uri).catch(() => {});
      }
      if (data) {
        await submitPhoto(data, signal, attemptId, generation);
      } else if (
        generation === scanGeneration.current &&
        isScanActive(signal)
      ) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.scan_no_recognizable_qr_code_found,
          }),
        });
      }
    } finally {
      isPickingImage.current = false;
    }
  }, [intl, isScanActive, photoRetryToastId, submitPhoto]);

  const onCameraScanned = useCallback(
    async (value: string) => {
      // Camera teardown is independent of the result and modal lifecycle.
      if (!value) return {};
      if (isPickingImage.current || handoffOwner.current) {
        return { retry: true };
      }
      defaultLogger.scanQrCode.readQrCode.readFromCamera(value);
      return callback(value);
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
                  qrWalletScene={qrWalletScene}
                />
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
          onClose={closeScanner}
        />
      </Page.Footer>
    </Page>
  );
}
