import walletConnectUtils from '../components/WalletConnect/utils/walletConnectUtils';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';
import { OneKeyMigrateQRCodePrefix } from '../views/Onboarding/screens/Migration/util';
import {
  ScanQrcodeRoutes,
  ScanSubResultCategory,
} from '../views/ScanQrcode/types';

import type { ScanResult } from '../views/ScanQrcode/types';

export const handleScanResult = (data: string) => {
  const scanResult: ScanResult = { type: ScanSubResultCategory.TEXT, data };
  if (data.startsWith('https://') || data.startsWith('http://')) {
    scanResult.type = ScanSubResultCategory.URL;
  } else if (data.startsWith(OneKeyMigrateQRCodePrefix)) {
    scanResult.type = ScanSubResultCategory.MIGRATE;
  } else if (/^wc:.+@.+\?.+/.test(data)) {
    // wc:{topic...}@{version...}?bridge={url...}&key={key...}
    // https://docs.walletconnect.com/tech-spec
    walletConnectUtils.openConnectToDappModal({
      uri: data,
    });
    return;
  }
  // move network detect to result page
  return scanResult;
};

export const gotoScanQrcode = (onScanCompleted?: (data: string) => void) => {
  const navigation = getAppNavigation();
  navigation.navigate(RootRoutes.Modal, {
    screen: ModalRoutes.ScanQrcode,
    params: {
      screen: ScanQrcodeRoutes.ScanQrcode,
      params: onScanCompleted
        ? {
            onScanCompleted,
          }
        : undefined,
    },
  });
};
