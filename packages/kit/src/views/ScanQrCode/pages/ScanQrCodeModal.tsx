import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Icon,
  Page,
  SizableText,
  Stack,
  TextArea,
  XStack,
  YStack,
} from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ScanQrCode } from '../components';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import type { IAppNavigation } from '../../../hooks/useAppNavigation';
import type { RouteProp } from '@react-navigation/core';

global.$$scanNavigation = undefined as IAppNavigation | undefined;
function DebugInput({ onText }: { onText: (text: string) => void }) {
  const navigation = useAppNavigation();
  global.$$scanNavigation = navigation;
  const [inputText, setInputText] = useState<string>('');
  const [visible, setVisible] = useState(false);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  if (visible) {
    return (
      <XStack>
        <Stack flex={1}>
          <TextArea
            value={inputText}
            onChangeText={setInputText}
            flex={1}
            placeholder="demo qrcode scan text"
          />
        </Stack>
        <Button onPress={() => onText(inputText)} size="small">
          Confirm
        </Button>
        <Button onPress={() => navigation.popStack()} size="small">
          Close
        </Button>
      </XStack>
    );
  }
  return (
    <XStack
      onPress={() => setVisible(true)}
      w="$8"
      h="$8"
      backgroundColor="transparent"
    />
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
      icon: 'Copy1Outline',
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
    {
      icon: 'ShieldCheckDoneOutline',
      title: intl.formatMessage({
        id: ETranslations.scan_screen_blurred_for_security,
      }),
    },
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
  const { callback, qrWalletScene, showProTutorial } = route.params;

  const isPickedImage = useRef(false);

  const pickImage = useCallback(async () => {
    isPickedImage.current = true;
    const result = await launchImageLibraryAsync({
      base64: !platformEnv.isNative,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      const data = await scanFromURLAsync(result.assets[0].uri);
      if (data) {
        isPickedImage.current = true;
        await callback(data);
      }
    }
  }, [callback]);

  const onCameraScanned = useCallback(
    async (value: string) => {
      if (isPickedImage.current) {
        return {};
      }
      return callback(value);
    },
    [callback],
  );

  const headerRightCall = useCallback(
    () => (
      <HeaderIconButton
        onPress={pickImage}
        icon="ImageSquareMountainOutline"
        testID="scan-open-photo"
        title={intl.formatMessage({ id: ETranslations.scan_select_a_photo })}
      />
    ),
    [intl, pickImage],
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
      {platformEnv.isDev ? (
        <Page.Footer>
          <DebugInput onText={callback} />
        </Page.Footer>
      ) : null}
    </Page>
  );
}
