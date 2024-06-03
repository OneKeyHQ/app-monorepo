import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  ListView,
  Page,
  Stack,
  TextArea,
  XStack,
} from '@onekeyhq/components';
import { NavCloseButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
  return (
    <XStack p="$4">
      <Stack flex={1}>
        <TextArea
          value={inputText}
          onChangeText={setInputText}
          flex={1}
          placeholder="demo qrcode scan text"
        />
      </Stack>
      <Button onPress={() => onText(inputText)}>Test</Button>
      <Button onPress={() => navigation.popStack()}>Close</Button>
    </XStack>
  );
}

const FOOTER_NORMAL_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
  { icon: 'Copy1Outline', title: 'Scan address codes to copy address' },
  {
    icon: 'WalletOutline',
    title: 'Scan WalletConnect code to connect to sites',
  },
];

const FOOTER_TUTORIAL_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
  {
    icon: 'QrCodeOutline',
    title:
      'To show your QR code, go to Connect App Wallet > QR Code > OneKey Wallet on your device',
  },
];

const FOOTER_SECURITY_ITEM_LIST: { title: string; icon: IKeyOfIcons }[] = [
  {
    icon: 'CameraExposureZoomInOutline',
    title: 'If it fails to scan, move closer to the screen and try again',
  },
  {
    icon: 'ShieldCheckDoneOutline',
    title:
      "We've blurred your screen for security, but it won't affect your scan",
  },
];

function ScanQrCodeModalFooter({
  qrWalletScene,
  showProTutorial,
}: {
  qrWalletScene?: boolean;
  showProTutorial?: boolean;
}) {
  return (
    <ListView
      mt="$5"
      data={
        qrWalletScene
          ? [
              ...(showProTutorial ? FOOTER_TUTORIAL_ITEM_LIST : []),
              ...FOOTER_SECURITY_ITEM_LIST,
            ]
          : FOOTER_NORMAL_ITEM_LIST
      }
      renderItem={({ item }) => (
        <ListItem
          p={0}
          m={0}
          mt="$4"
          icon={item.icon}
          title={item.title}
          iconProps={{ size: 'small' }}
          titleProps={{
            size: '$bodyMd',
            color: '$textSubdued',
            marginTop: '$.5',
          }}
          ai="flex-start"
        />
      )}
      estimatedItemSize="$10"
    />
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

  const headerLeftCall = useCallback(
    () => (
      <Page.Close>
        <NavCloseButton mr="$4" />
      </Page.Close>
    ),
    [],
  );

  const headerRightCall = useCallback(
    () => (
      <HeaderIconButton
        onPress={pickImage}
        icon="ImageSquareMountainOutline"
        testID="scan-open-photo"
      />
    ),
    [pickImage],
  );

  const { width: screenWidth } = useWindowDimensions();
  const mdSize = screenWidth - 40;
  const gtMdSize = 250;

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: 'title__scan_qr_code',
        })}
        disableClose
        headerLeft={headerLeftCall}
        headerRight={headerRightCall}
      />
      <Page.Body ai="center" $gtMd={{ jc: 'center' }}>
        <Stack
          flex={1}
          $md={{ width: mdSize, mt: '$5' }}
          $gtMd={{ width: gtMdSize }}
        >
          <Stack
            $md={{ height: mdSize }}
            $gtMd={{ height: gtMdSize }}
            borderRadius="$5"
            overflow="hidden"
          >
            <ScanQrCode
              handleBarCodeScanned={onCameraScanned}
              qrWalletScene={qrWalletScene}
            />
          </Stack>
          <ScanQrCodeModalFooter
            qrWalletScene={qrWalletScene}
            showProTutorial={showProTutorial}
          />
        </Stack>
      </Page.Body>
      {platformEnv.isDev ? (
        <Page.Footer>
          <DebugInput onText={callback} />
        </Page.Footer>
      ) : null}
    </Page>
  );
}
