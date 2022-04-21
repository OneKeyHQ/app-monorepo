import React, { FC, useEffect, useState } from 'react';

import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import { Camera } from 'expo-camera';

import * as ImagePicker from 'expo-image-picker';

import {
  Center,
  Icon,
  Modal,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import SvgScanArea from './SvgScanArea';
import { scanFromURLAsync } from './scanFromURLAsync';

const { isDesktop, isWeb, isExtension, isNative: isApp } = platformEnv;

export type ScanQrcodeProps = {};

const ScanQrcode: FC<ScanQrcodeProps> = ({}: ScanQrcodeProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [scanned, setScanned] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.cancelled) {
      const scanResult = await scanFromURLAsync(result.uri);
      if (scanResult) {
        handleBarCodeScanned(scanResult);
      } else {
        // TODO invalid code
      }
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  const ChooseImageText = isApp ? Typography.Button1 : Typography.Button2;
  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'title__scan_qr_code' })}
      footer={
        <Button
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
      staticChildrenProps={{ width: '100%', height: 209 }}
    >
      {hasPermission && (
        <Camera
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: ['qr'],
          }}
        >
          <Center top={0} bottom={0} left={0} right={0} position="absolute">
            <SvgScanArea width={144} height={144} />
          </Center>
        </Camera>
      )}
    </Modal>
  );
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
