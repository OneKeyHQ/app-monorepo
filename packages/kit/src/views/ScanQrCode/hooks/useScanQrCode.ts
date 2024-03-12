import { useCallback, useMemo } from 'react';

import type {
  IBaseValue,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import {
  EModalRoutes,
  EScanQrCodeModalPages,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

import useParseQRCode from './useParseQRCode';

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
  return useMemo(() => ({ start }), [start]);
}
