import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
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
  useSafeAreaInsets,
} from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getAvailabilityErrorCode } from '@onekeyhq/shared/src/request/availabilityMetrics';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { MultipleClickStack } from '../../../components/MultipleClickStack';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ScanQrCode } from '../components';
import { ScanQrCodeTestIDs } from '../testIDs';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import type { RouteProp } from '@react-navigation/core';

appGlobals.$$scanNavigation = undefined;
function DebugInput({ onText }: { onText: (text: string) => void }) {
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
            onPress={() => navigation.popStack()}
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
        triggerAt={process.env.NODE_ENV === 'production' ? 10 : 1}
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

  const availabilityScene = qrWalletScene ? 'qr_wallet' : 'general';
  const cameraAttemptRef = useRef<{
    attemptId: string;
    reported: boolean;
    startedAt: number;
  } | null>(null);
  if (!cameraAttemptRef.current) {
    cameraAttemptRef.current = {
      attemptId: generateUUID(),
      reported: false,
      startedAt: Date.now(),
    };
  }

  useEffect(() => {
    const cameraAttempt = cameraAttemptRef.current;
    if (!cameraAttempt) return;
    defaultLogger.scanQrCode.readQrCode.qrScanAttempt({
      attemptId: cameraAttempt.attemptId,
      input: 'camera',
      scene: availabilityScene,
    });
  }, [availabilityScene]);

  const finishQrScanAttempt = useCallback(
    ({
      attempt,
      errorCode = 'unknown',
      input,
      status,
    }: {
      attempt: {
        attemptId: string;
        reported: boolean;
        startedAt: number;
      };
      errorCode?: string;
      input: 'camera' | 'library';
      status: 'cancelled' | 'failed' | 'no_code' | 'success';
    }) => {
      if (attempt.reported) return;
      attempt.reported = true;
      defaultLogger.scanQrCode.readQrCode.qrScanResult({
        attemptId: attempt.attemptId,
        durationMs: Math.max(0, Date.now() - attempt.startedAt),
        errorCode,
        input,
        scene: availabilityScene,
        status,
      });
    },
    [availabilityScene],
  );

  const callback = useCallback(
    async (value: string) => {
      if (process.env.NODE_ENV !== 'production') {
        if (value) {
          appStorage.syncStorage.set(
            EAppSyncStorageKeys.last_scan_qr_code_text,
            value,
          );
        }
      }

      return routeCallback({ value, popNavigation: true });
    },
    [routeCallback],
  );

  const isPickedImage = useRef(false);

  const pickImage = useCallback(async () => {
    const attempt = {
      attemptId: generateUUID(),
      reported: false,
      startedAt: Date.now(),
    };
    defaultLogger.scanQrCode.readQrCode.qrScanAttempt({
      attemptId: attempt.attemptId,
      input: 'library',
      scene: availabilityScene,
    });
    try {
      const result = await launchImageLibraryAsync({
        base64: !platformEnv.isNative,
        allowsMultipleSelection: false,
      });

      if (result.canceled) {
        finishQrScanAttempt({ attempt, input: 'library', status: 'cancelled' });
        return;
      }
      const uri = result?.assets?.[0]?.uri;
      let data: string | null = null;
      let scanError: unknown;
      try {
        data = await scanFromURLAsync(uri);
      } catch (error) {
        scanError = error;
        data = null;
      }
      if (data && data.length > 0) {
        isPickedImage.current = true;
        await callback(data);
        finishQrScanAttempt({ attempt, input: 'library', status: 'success' });
      } else {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.scan_no_recognizable_qr_code_found,
          }),
        });
        finishQrScanAttempt({
          attempt,
          errorCode: scanError
            ? getAvailabilityErrorCode(scanError)
            : 'no_code',
          input: 'library',
          status: scanError ? 'failed' : 'no_code',
        });
      }
      defaultLogger.scanQrCode.readQrCode.readFromLibrary(
        JSON.stringify(result),
        data,
      );
    } catch (error) {
      finishQrScanAttempt({
        attempt,
        errorCode: getAvailabilityErrorCode(error),
        input: 'library',
        status: 'failed',
      });
      throw error;
    }
  }, [availabilityScene, callback, finishQrScanAttempt, intl]);

  const onCameraScanned = useCallback(
    async (value: string) => {
      if (isPickedImage.current) {
        return {};
      }
      defaultLogger.scanQrCode.readQrCode.readFromCamera(value);
      const cameraAttempt = cameraAttemptRef.current;
      try {
        const result = await callback(value);
        if (cameraAttempt) {
          finishQrScanAttempt({
            attempt: cameraAttempt,
            input: 'camera',
            status: value ? 'success' : 'cancelled',
          });
        }
        return result;
      } catch (error) {
        if (cameraAttempt) {
          finishQrScanAttempt({
            attempt: cameraAttempt,
            errorCode: getAvailabilityErrorCode(error),
            input: 'camera',
            status: 'failed',
          });
        }
        throw error;
      }
    },
    [callback, finishQrScanAttempt],
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

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        headerRight={headerRightCall}
      />
      <Page.Body $gtMd={{ jc: 'center' }}>
        <Stack
          w="100%"
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
                  handleBarCodeScanned={onCameraScanned}
                  qrWalletScene={qrWalletScene}
                />
              </Stack>
            </YStack>
          </Stack>
        </Stack>
        <ScanQrCodeModalFooter
          qrWalletScene={qrWalletScene}
          showProTutorial={showProTutorial}
        />
      </Page.Body>
      <Page.Footer>
        <DebugInput onText={(value) => callback(value)} />
      </Page.Footer>
    </Page>
  );
}
