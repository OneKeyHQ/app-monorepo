import { Button, SecureQRToast } from '@onekeyhq/components';
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
              onPress={async () => {
                await SecureQRToast.show({ value: 'https://onekey.so' });
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
              onPress={async () => {
                await SecureQRToast.show({
                  value: 'https://onekey.so',
                  showQRCode: false,
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
              onPress={async () => {
                await SecureQRToast.show({ value: 'https://onekey.so' });
                await scanQrCode.start({
                  autoHandleResult: true,
                  handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
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
