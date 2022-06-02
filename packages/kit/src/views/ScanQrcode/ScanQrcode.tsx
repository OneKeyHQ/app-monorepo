import React, { FC, useCallback, useEffect, useState } from 'react';

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
  Icon,
  Modal,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PermissionDialog from '../../components/PermissionDialog/PermissionDialog';
import { setHaptics } from '../../hooks/setHaptics';
import useNavigation from '../../hooks/useNavigation';

import ScanCamera from './ScanCamera';
import { scanFromURLAsync } from './scanFromURLAsync';
import SvgScanArea from './SvgScanArea';
import { ScanQrcodeRoutes, ScanQrcodeRoutesParams, ScanResult } from './types';
import { handleScanResult } from '../../utils/gotoScanQrcode';

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
  const [scanned, setScanned] = useState(false);
  const isFocused = useIsFocused();

  const navigation = useNavigation<ScanQrcodeNavProp>();
  const route = useRoute<ScanQrcodeRouteProp>();
  const onScanCompleted = route.params?.onScanCompleted;

  const handleBarCodeScanned = useCallback(
    async (data?: string | null) => {
      if (!data) {
        return;
      }
      setScanned(true);
      setHaptics();
      if (onScanCompleted) {
        onScanCompleted(data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        navigation.goBack();
        return;
      }
      const scanResult = await handleScanResult(data);
      if (scanResult) {
        navigation.navigate(ScanQrcodeRoutes.ScanQrcodeResult, scanResult);
      }
    },
    [navigation, onScanCompleted],
  );

  const pickImage = useCallback(async () => {
    setHaptics();
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: isWeb,
      allowsMultipleSelection: false,
    });

    if (!result.cancelled) {
      const data = await scanFromURLAsync(result.uri);
      data && handleBarCodeScanned(data);
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
      setScanned(false);
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
            leftIcon={<Icon name="PhotographSolid" size={isApp ? 19 : 15} />}
          >
            <ChooseImageText>
              {intl.formatMessage({ id: 'action__choose_an_image' })}
            </ChooseImageText>
          </Button>
        }
        staticChildrenProps={
          isApp ? { flex: 1 } : { width: '100%', height: 209 }
        }
      >
        <ScanCamera
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          isActive={isFocused && !scanned}
          onQrcodeScanned={handleBarCodeScanned}
        >
          <SvgScanArea
            style={{ position: 'absolute' }}
            width="256px"
            height="256px"
          />
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
