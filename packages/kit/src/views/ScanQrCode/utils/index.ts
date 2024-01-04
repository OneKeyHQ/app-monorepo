import { ERootRoutes } from '../../../routes/enum';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EScanQrCodeModalPages } from '../router/type';

import type { NavigationProp } from '@react-navigation/native';

export function startScanQrCode(
  navigation: NavigationProp<any, any, any, any, any, any>,
) {
  return new Promise((resolve, reject) => {
    navigation.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.ScanQrCodeModal,
      params: {
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
      },
    });
  });
}
