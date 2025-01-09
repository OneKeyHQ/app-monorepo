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
                const toast = SecureQRToast.show({
                  value: 'https://onekey.so',
                  onCancel: async () => {
                    await toast.close();
                  },
                  onConfirm: async () => {
                    await toast.close();
                  },
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
                const toast = SecureQRToast.show({
                  value: 'https://onekey.so',
                  showQRCode: false,
                  onCancel: async () => {
                    await toast.close();
                  },
                  onConfirm: async () => {
                    await toast.close();
                  },
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
          title: 'SecureQRToast + showConfirmButton',
          element: (
            <Button
              onPress={() => {
                const toast = SecureQRToast.show({
                  value: 'https://onekey.so',
                  showConfirmButton: false,
                  onCancel: async () => {
                    await toast.close();
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
        {
          title: 'SecureQRToast + useScanQrCode',
          element: (
            <Button
              onPress={() => {
                const toast = SecureQRToast.show({
                  title: 'AAA',
                  message: 'BBBB',
                  dismissOnOverlayPress: false,
                  value: 'https://onekey.so',
                  onConfirm: async () => {
                    await toast.close();
                    await scanQrCode.start({
                      autoHandleResult: true,
                      handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
                    });
                  },
                  onCancel: async () => {
                    await toast.close();
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
