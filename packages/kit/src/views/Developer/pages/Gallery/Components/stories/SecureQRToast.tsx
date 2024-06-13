import { Button } from '@onekeyhq/components';
import { SecureQRToast } from '@onekeyhq/kit/src/components/SecureQRToast';
import useScanQrCode from '@onekeyhq/kit/src/views/ScanQrCode/hooks/useScanQrCode';

import { Layout } from './utils/Layout';

const SecureQRToastGallery = () => {
  const scanQrCode = useScanQrCode();
  return (
    <Layout
      description=""
      suggestions={[]}
      boundaryConditions={[]}
      elements={[
        {
          title: 'SecureQRToast',
          element: (
            <Button
              onPress={() => {
                SecureQRToast.show({
                  value: 'https://onekey.so',
                  onClose: () => {
                    console.log('onClose');
                  },
                });
              }}
            >
              点击单独显示
            </Button>
          ),
        },
        {
          title: 'SecureQRToast',
          element: (
            <Button
              onPress={() => {
                SecureQRToast.show({
                  value: 'https://onekey.so',
                  showQRCode: false,
                  onClose: () => {
                    console.log('onClose');
                  },
                });
              }}
            >
              点击单独显示(默认不展示)
            </Button>
          ),
        },
        {
          title: 'SecureQRToast + useScanQrCode',
          element: (
            <Button
              onPress={() => {
                SecureQRToast.show({
                  value: 'https://onekey.so',
                  onConfirm: async () => {
                    await scanQrCode.start({
                      autoHandleResult: true,
                      handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
                    });
                  },
                  onClose: () => {
                    console.log('onClose');
                  },
                });
              }}
            >
              点击显示后续流程
            </Button>
          ),
        },
      ]}
    />
  );
};

export default SecureQRToastGallery;
