import { useCallback } from 'react';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EScanQrCodeModalPages } from '../router/type';

import useParseQRCode from './useParseQRCode';

import type {
  IBaseValue,
  IQRCodeHandlerParseResult,
} from '../utils/parseQRCode/type';

export default function useScanQrCode() {
  const navigation = useAppNavigation();
  const parseQRCode = useParseQRCode();
  const start = useCallback(
    (autoHandleResult = true) =>
      new Promise<IQRCodeHandlerParseResult<IBaseValue>>((resolve, reject) => {
        navigation.pushModal(EModalRoutes.ScanQrCodeModal, {
          screen: EScanQrCodeModalPages.ScanQrCodeStack,
          params: {
            callback: async (value: string) => {
              if (value?.length > 0) {
                const parseValue = await parseQRCode.parse(value, {
                  autoHandleResult,
                });
                resolve(parseValue);
              } else {
                reject();
              }
            },
          },
        });
      }),
    [navigation, parseQRCode],
  );
  return {
    start,
  };
}
