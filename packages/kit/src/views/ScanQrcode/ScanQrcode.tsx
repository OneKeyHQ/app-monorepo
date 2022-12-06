import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import {
  NavigationProp,
  RouteProp,
  useIsFocused,
  useRoute,
} from '@react-navigation/core';
import { Camera as ExpoCamera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Center,
  Icon,
  Modal,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PermissionDialog from '../../components/PermissionDialog/PermissionDialog';
import useNavigation from '../../hooks/useNavigation';
import { handleScanResult } from '../../utils/gotoScanQrcode';

import ScanCamera from './ScanCamera';
import { scanFromURLAsync } from './scanFromURLAsync';
import SvgScanArea from './SvgScanArea';
import { ScanQrcodeRoutes, ScanQrcodeRoutesParams } from './types';

const { isWeb, isNative: isApp } = platformEnv;

type ScanQrcodeRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcode
>;
type ScanQrcodeNavProp = NavigationProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;
const ScanQrcode: FC = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [currentPermission, setCurrentPermission] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED,
  );
  const scanned = useRef(false);
  const isFocused = useIsFocused();
  const isVerticalLayout = useIsVerticalLayout();

  const navigation = useNavigation<ScanQrcodeNavProp>();
  const route = useRoute<ScanQrcodeRouteProp>();
  const onScanCompleted = route.params?.onScanCompleted;

  const handleBarCodeScanned = useCallback(
    async (data?: string | null) => {
      if (scanned.current || !data) {
        return;
      }
      scanned.current = true;
      if (onScanCompleted) {
        onScanCompleted(data);
        navigation.goBack();
        return;
      }
      const scanResult = await handleScanResult(data);
      if (scanResult) {
        // @ts-expect-error type missing
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        navigation.replace(ScanQrcodeRoutes.ScanQrcodeResult, scanResult);
      } else {
        navigation.goBack();
      }
    },
    [navigation, onScanCompleted],
  );

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: isWeb,
      allowsMultipleSelection: false,
    });

    if (!result.cancelled) {
      const data = await scanFromURLAsync(result.uri);
      if (data) handleBarCodeScanned(data);
    }
  }, [handleBarCodeScanned]);

  useEffect(() => {
    (async () => {
      const { status } = await ExpoCamera.requestCameraPermissionsAsync();
      setCurrentPermission(status);
    })();
  }, []);

  useEffect(() => {
    if (isFocused) {
      // reactivate scanning when return to this page
      scanned.current = false;
    }
  }, [isFocused]);

  const ChooseImageText = isApp ? Typography.Button1 : Typography.Button2;
  if (currentPermission === PermissionStatus.GRANTED) {
    return (
      <Modal
        hidePrimaryAction
        hideSecondaryAction
        header={intl.formatMessage({ id: 'title__scan_qr_code' })}
        footer={
          <Button
            style={{ marginBottom: bottom }}
            onPress={pickImage}
            h={isApp ? '55px' : '45px'}
            variant="unstyled"
            leftIcon={<Icon name="PhotoMini" size={isApp ? 19 : 15} />}
          >
            <ChooseImageText>
              {intl.formatMessage({ id: 'action__choose_an_image' })}
            </ChooseImageText>
          </Button>
        }
        staticChildrenProps={
          isVerticalLayout || platformEnv.isNativeIOS
            ? { flex: 1 }
            : { width: '100%', height: 418 }
        }
      >
        <ScanCamera
          style={{
            flex: 1,
          }}
          isActive={isFocused}
          onQrcodeScanned={handleBarCodeScanned}
        >
          <Center position="absolute" w="full" h="full">
            <SvgScanArea width="256px" height="256px" />
          </Center>
        </ScanCamera>
      </Modal>
    );
  }
  if (currentPermission === PermissionStatus.DENIED) {
    return <PermissionDialog type="camera" />;
  }
  return null;
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
