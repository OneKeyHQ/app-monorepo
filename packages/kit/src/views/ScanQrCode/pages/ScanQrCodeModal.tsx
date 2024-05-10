import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';

import { Button, Input, Page, Stack, XStack } from '@onekeyhq/components';
import { NavCloseButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '@onekeyhq/shared/src/routes';

import { ScanQrCode } from '../components';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import type { RouteProp } from '@react-navigation/core';

export default function ScanQrCodeModal() {
  const [inputText, setInputText] = useState<string>('');
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IScanQrCodeModalParamList,
        EScanQrCodeModalPages.ScanQrCodeStack
      >
    >();
  const { callback } = route.params;

  const pickImage = useCallback(async () => {
    const result = await launchImageLibraryAsync({
      base64: !platformEnv.isNative,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      const data = await scanFromURLAsync(result.assets[0].uri);
      if (data) callback(data);
    }
  }, [callback]);

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

  const debugInput = useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      // check callback handler of useParseQRCode
      return (
        <XStack>
          <Stack flex={1}>
            <Input
              value={inputText}
              onChangeText={setInputText}
              flex={1}
              placeholder="demo qrcode scan text"
            />
          </Stack>
          <Button onPress={() => callback(inputText)}>Test</Button>
        </XStack>
      );
    }
    return null;
  }, [callback, inputText]);

  return (
    <Page>
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
        <ScanQrCode handleBarCodeScanned={callback} />
        {debugInput}
      </Page.Body>
    </Page>
  );
}
