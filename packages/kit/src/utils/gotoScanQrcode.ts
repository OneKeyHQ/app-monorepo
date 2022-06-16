import { UserCreateInputCategory } from '@onekeyhq/engine/src/types/credential';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../routes/types';
import { ScanQrcodeRoutes, ScanResult } from '../views/ScanQrcode/types';

export const handleScanResult = async (data: string) => {
  const scanResult: ScanResult = { type: 'other', data };
  if (data.startsWith('https://') || data.startsWith('http://')) {
    scanResult.type = 'url';
  } else if (/^wc:.+@.+\?.+/.test(data)) {
    // wc:{topic...}@{version...}?bridge={url...}&key={key...}
    // https://docs.walletconnect.com/tech-spec
    await backgroundApiProxy.walletConnect.connect({
      uri: data,
    });
    return;
  } else {
    const { category, possibleNetworks } =
      await backgroundApiProxy.validator.validateCreateInput(data);
    if (category === UserCreateInputCategory.ADDRESS) {
      scanResult.type = 'address';
      scanResult.possibleNetworks = possibleNetworks;
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
