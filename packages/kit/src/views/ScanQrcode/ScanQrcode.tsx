import React, { FC, useEffect, useState } from 'react';

import { BarCodeScanner } from 'expo-barcode-scanner';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import { Camera } from 'expo-camera';
import {
  Box,
  Icon,
  Modal,
  Text,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const { isDesktop, isWeb, isExtension, isNative } = platformEnv;
const isApp = isNative;

export type ScanQrcodeProps = {};

const ScanQrcode: FC<ScanQrcodeProps> = ({}: ScanQrcodeProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  return (
    <Modal
      height="300px"
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'title__scan_qr_code' })}
      footer={
        <Button
          variant="unstyled"
          leftIcon={<Icon name="PhotographOutline" size={16} />}
        >
          {intl.formatMessage({ id: 'action__choose_an_image' })}
        </Button>
      }
      staticChildrenProps={{ flex: 1 }}
    >
      {hasPermission && (
        <Camera
          style={{ width: '100%', height: '100%' }}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
          }}
        />
      )}
    </Modal>
  );
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
