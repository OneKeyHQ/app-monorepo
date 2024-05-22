import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';

import {
  Button,
  Input,
  Page,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
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

function DebugInput({ onText }: { onText: (text: string) => void }) {
  const [inputText, setInputText] = useState<string>('');
  return (
    <XStack p="$4">
      <Stack flex={1}>
        <Input
          value={inputText}
          onChangeText={setInputText}
          flex={1}
          placeholder="demo qrcode scan text"
        />
      </Stack>
      <Button onPress={() => onText(inputText)}>Test</Button>
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
        <ScanQrCode handleBarCodeScanned={callback} mask={mask} />
      </Page.Body>
      {platformEnv.isDev ? (
        <Page.Footer>
          <DebugInput onText={callback} />
        </Page.Footer>
      ) : null}
    </Page>
  );
}
