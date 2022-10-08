import * as ImagePicker from 'expo-image-picker';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import walletConnectUtils from '../components/WalletConnect/utils/walletConnectUtils';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../routes/types';
import { scanFromURLAsync } from '../views/ScanQrcode/scanFromURLAsync';
import {
  ScanQrcodeRoutes,
  ScanResult,
  ScanSubResultCategory,
} from '../views/ScanQrcode/types';

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

export const gotoScanQrcode = async (
  onScanCompleted?: (data: string) => void,
) => {
  const navigation = getAppNavigation();
  // FIXME: later try some tricky workaround to get camera access for extension
  // https://stackoverflow.com/questions/50991321/chrome-extension-getusermedia-throws-notallowederror-failed-due-to-shutdown
  if (platformEnv.isExtension) {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      allowsMultipleSelection: false,
    });

    if (!result.cancelled) {
      const data = await scanFromURLAsync(result.uri);
      if (data) {
        if (onScanCompleted) {
          onScanCompleted(data);
          return;
        }
        const scanResult = await handleScanResult(data);
        if (scanResult) {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ScanQrcode,
            params: {
              screen: ScanQrcodeRoutes.ScanQrcodeResult,
              params: scanResult,
            },
          });
        }
      } else {
        // TODO invalid qrcode
      }
    }
  } else {
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
  }
};
