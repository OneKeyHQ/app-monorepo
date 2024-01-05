import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useIntl } from 'react-intl';

import { Page, ScanQrCode } from '@onekeyhq/components';
import HeaderIconButton from '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { scanFromURLAsync } from '../utils/scanFromURLAsync';

import type {
  EScanQrCodeModalPages,
  IScanQrCodeModalParamList,
} from '../router/type';
import type { RouteProp } from '@react-navigation/core';

export default function ScanQrCodeModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IScanQrCodeModalParamList,
        EScanQrCodeModalPages.ScanQrCodeStack
      >
    >();
  const { callback } = route.params;

  const overrideCallback = useCallback(
    (value: string) => {
      callback(value);
      navigation.pop();
    },
    [navigation, callback],
  );

  const pickImage = useCallback(async () => {
    const result = await launchImageLibraryAsync({
      base64: !platformEnv.isNative,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      const data = await scanFromURLAsync(result.assets[0].uri);
      if (data) overrideCallback(data);
    }
  }, [overrideCallback]);
  const headerRightCall = useCallback(
    () => (
      <HeaderIconButton onPress={pickImage} icon="ImageSquareMountainOutline" />
    ),
    [pickImage],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: 'title__scan_qr_code',
        })}
        headerTransparent
        headerTintColor="white"
        headerRight={headerRightCall}
      />
      <Page.Body>
        <ScanQrCode handleBarCodeScanned={overrideCallback} />
      </Page.Body>
    </Page>
  );
}
