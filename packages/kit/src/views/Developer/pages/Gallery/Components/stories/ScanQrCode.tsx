import { useCallback, useState } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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
            handleBarCodeScanned={async (value) => {
              alert(value);
              return {};
            }}
          />
        </Stack>
      ) : null}
    </>
  );
};

const ScanQRCodeGallery = () => {
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const openScanQrCodeModal = useCallback(
    async (values: {
      autoHandleResult: boolean;
      qrWalletScene?: boolean;
      showProTutorial?: boolean;
    }) => {
      try {
        const result = await scanQrCode.start({
          ...values,
          accountId: account?.id,
        });
        console.log(result);
      } catch (e) {
        console.log('用户取消扫描');
      }
    },
    [scanQrCode, account?.id],
  );
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: '命令式弹出 Modal(自动处理)',
          element: (
            <Button
              onPress={() => openScanQrCodeModal({ autoHandleResult: true })}
            >
              打开
            </Button>
          ),
        },
        {
          title:
            '命令式弹出 Modal(不自动处理，qrWalletScene = true & showProTutorial = false)',
          element: (
            <Button
              onPress={() =>
                openScanQrCodeModal({
                  autoHandleResult: false,
                  qrWalletScene: true,
                  showProTutorial: false,
                })
              }
            >
              打开
            </Button>
          ),
        },
        {
          title:
            '命令式弹出 Modal(不自动处理，qrWalletScene = true & showProTutorial = true)',
          element: (
            <Button
              onPress={() =>
                openScanQrCodeModal({
                  autoHandleResult: false,
                  qrWalletScene: true,
                  showProTutorial: true,
                })
              }
            >
              打开
            </Button>
          ),
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
