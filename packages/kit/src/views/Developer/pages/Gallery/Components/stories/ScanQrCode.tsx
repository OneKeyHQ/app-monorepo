import { useCallback, useState } from 'react';

import { Button, ScanQrCode, Stack } from '@onekeyhq/components';

import useAppNavigation from '../../../../../../hooks/useAppNavigation';
import { startScanQrCode } from '../../../../../ScanQrCode/utils';

import { Layout } from './utils/Layout';

const ScanQrCameraDemo = () => {
  const [isShow, setIsShow] = useState(false);
  return (
    <>
      <Button onPress={() => setIsShow(!isShow)}>
        {isShow ? '关闭' : '打开'}
      </Button>
      {isShow && (
        <Stack mt={20} w={360} h={600}>
          <ScanQrCode
            handleBarCodeScanned={(value) => {
              alert(value);
            }}
          />
        </Stack>
      )}
    </>
  );
};

const ScanQRCodeGallery = () => {
  const navigation = useAppNavigation();
  const openScanQrCodeModal = useCallback(() => {
    startScanQrCode(navigation as any)
      .then((value) => {
        alert(value);
      })
      .catch((e) => {
        console.log(e);
      });
  }, [navigation]);
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: '命令式弹出 Modal',
          element: <Button onPress={openScanQrCodeModal}>打开</Button>,
        },
        {
          title: '单独测试 Camera 权限等',
          element: <ScanQrCameraDemo />,
        },
      ]}
    />
  );
};

export default ScanQRCodeGallery;
