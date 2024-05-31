import { useCallback, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';

import { Button, Page, Stack, TextArea, XStack } from '@onekeyhq/components';
import { NavCloseButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
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

export default function ScanQrCodeModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IScanQrCodeModalParamList,
        EScanQrCodeModalPages.ScanQrCodeStack
      >
    >();
  const { callback, mask } = route.params;

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
        <NavCloseButton
          mr="$4"
          iconProps={{
            color: '$whiteA12',
          }}
        />
      </Page.Close>
    ),
    [],
  );

  const headerRightCall = useCallback(
    () => (
      <HeaderIconButton
        onPress={pickImage}
        icon="ImageSquareMountainOutline"
        iconProps={{
          color: '$whiteA12',
        }}
        testID="scan-open-photo"
      />
    ),
    [pickImage],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: 'title__scan_qr_code',
        })}
        disableClose
        headerTransparent
        headerTitleStyle={{
          color: '#ffffff',
        }}
        headerLeft={headerLeftCall}
        headerTintColor="white"
        headerRight={headerRightCall}
      />
      <Page.Body>
        <ScanQrCode handleBarCodeScanned={onCameraScanned} mask={mask} />
      </Page.Body>
      {platformEnv.isDev ? (
        <Page.Footer>
          <DebugInput onText={callback} />
        </Page.Footer>
      ) : null}
    </Page>
  );
}
