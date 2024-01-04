import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EScanQrCodeModalPages } from '../router/type';

export default function useScanQrCode() {
  const navigation = useAppNavigation();
  const start = () =>
    new Promise<string>((resolve, reject) => {
      navigation.pushModal(EModalRoutes.ScanQrCodeModal, {
        screen: EScanQrCodeModalPages.ScanQrCodeModal,
        params: {
          callback: (value: string) => {
            if (value?.length > 0) {
              resolve(value);
            } else {
              reject(value);
            }
          },
        },
      });
    });
  return {
    start,
  };
}
