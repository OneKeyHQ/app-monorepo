import { useCallback, useState } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ScanQrCode } from '@onekeyhq/kit/src/views/ScanQrCode/components';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { Layout } from './utils/Layout';

const ScanQrCameraDemo = () => {
  const [isShow, setIsShow] = useState(false);
  return (
    <>
      <Button onPress={() => setIsShow(!isShow)}>
        {isShow ? '关闭' : '打开'}
      </Button>
      {isShow ? (
        <Stack mt={20} w={360} h={600}>
          <ScanQrCode
            handleBarCodeScanned={(value) => {
              alert(value);
            }}
          />
        </Stack>
      ) : null}
    </>
  );
};

const ScanQRCodeGallery = () => {
  const scanQrCode = useScanQrCode();
  const openScanQrCodeModal = useCallback(async () => {
    const result = await scanQrCode.start(true);
    console.log(result);
  }, [scanQrCode]);
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

function ScanQRCodeGalleryContainer() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ScanQRCodeGallery />
    </AccountSelectorProviderMirror>
  );
}

export default ScanQRCodeGalleryContainer;
