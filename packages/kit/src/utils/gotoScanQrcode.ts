import * as ImagePicker from 'expo-image-picker';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { getAppNavigation } from '../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../routes/types';
import { scanFromURLAsync } from '../views/ScanQrcode/scanFromURLAsync';
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
    const possibleNetworks =
      await backgroundApiProxy.validator.validateAnyAddress(data);
    if (possibleNetworks.length > 0) {
      scanResult.type = 'address';
      scanResult.possibleNetworks = possibleNetworks;
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
