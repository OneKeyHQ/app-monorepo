import { useCallback, useMemo } from 'react';

import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseOutsideOptions,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
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
    ({
      autoHandleResult = true,
      accountId,
    }: IQRCodeHandlerParseOutsideOptions) =>
      new Promise<IQRCodeHandlerParseResult<IBaseValue>>((resolve, reject) => {
        navigation.pushFullModal(EModalRoutes.ScanQrCodeModal, {
          screen: EScanQrCodeModalPages.ScanQrCodeStack,
          params: {
            callback: async (value: string) => {
              if (value?.length > 0) {
                const parseValue = await parseQRCode.parse(value, {
                  autoHandleResult,
                  accountId,
                });
                if (
                  parseValue.type !== EQRCodeHandlerType.ANIMATION_CODE ||
                  (parseValue.data as IAnimationValue).fullData
                ) {
                  resolve(parseValue);
                }
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
