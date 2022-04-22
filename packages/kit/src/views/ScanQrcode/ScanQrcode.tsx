import React, { FC, useEffect, useState } from 'react';

import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Icon,
  Modal,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { scanFromURLAsync } from './scanFromURLAsync';
import SvgScanArea from './SvgScanArea';

const { isDesktop, isWeb, isExtension, isNative: isApp } = platformEnv;

export type ScanQrcodeProps = {};

const ScanQrcode: FC<ScanQrcodeProps> = ({}: ScanQrcodeProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [scanned, setScanned] = useState(false);

  function handleBarCodeScanned(data: string | null) {
    setScanned(true);
    alert(data);
  }
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: isWeb,
      allowsMultipleSelection: false,
    });

    if (!result.cancelled) {
      const scanResult = await scanFromURLAsync(result.uri);
      if (scanResult) {
        handleBarCodeScanned(scanResult);
      }
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const ChooseImageText = isApp ? Typography.Button1 : Typography.Button2;
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
      staticChildrenProps={isApp ? { flex: 1 } : { width: '100%', height: 209 }}
    >
      {hasPermission && (
        <Camera
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onBarCodeScanned={
            scanned ? undefined : ({ data }) => handleBarCodeScanned(data)
          }
          barCodeScannerSettings={{
            barCodeTypes: ['qr'],
          }}
        >
          <SvgScanArea
            style={{ position: 'absolute' }}
            width={144}
            height={144}
          />
        </Camera>
      )}
    </Modal>
  );
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
