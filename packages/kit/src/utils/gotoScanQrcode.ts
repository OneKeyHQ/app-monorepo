import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import walletConnectUtils from '../components/WalletConnect/utils/walletConnectUtils';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../routes/types';
import {
  ScanQrcodeRoutes,
  ScanSubResultCategory,
} from '../views/ScanQrcode/types';

import type { ScanResult } from '../views/ScanQrcode/types';

export const handleScanResult = async (data: string) => {
  const scanResult: ScanResult = { type: ScanSubResultCategory.TEXT, data };
  if (data.startsWith('https://') || data.startsWith('http://')) {
    scanResult.type = ScanSubResultCategory.URL;
  } else if (/^wc:.+@.+\?.+/.test(data)) {
    // wc:{topic...}@{version...}?bridge={url...}&key={key...}
    // https://docs.walletconnect.com/tech-spec
    walletConnectUtils.openConnectToDappModal({
      uri: data,
    });
    return;
  } else {
    try {
      const [result] = await backgroundApiProxy.validator.validateCreateInput({
        input: data,
        returnEarly: true,
      });
      if (result) {
        scanResult.type = result.category;
        scanResult.possibleNetworks = result.possibleNetworks;
      }
    } catch (e) {
      debugLogger.backgroundApi.error(e);
    }
  }
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
