import { useCallback, useMemo } from 'react';

import { Vibration } from 'react-native';

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
      autoHandleResult = false,
      accountId,
      mask = false,
    }: IQRCodeHandlerParseOutsideOptions) =>
      new Promise<IQRCodeHandlerParseResult<IBaseValue>>((resolve, reject) => {
        navigation.pushFullModal(EModalRoutes.ScanQrCodeModal, {
          screen: EScanQrCodeModalPages.ScanQrCodeStack,
          params: {
            mask,
            callback: async (value: string) => {
              if (value?.length > 0) {
                const parseValue = await parseQRCode.parse(value, {
                  autoHandleResult,
                  accountId,
                });
                if (parseValue.type === EQRCodeHandlerType.ANIMATION_CODE) {
                  const animationValue = parseValue.data as IAnimationValue;
                  if (animationValue.fullData) {
                    resolve(parseValue);
                  }
                  Vibration.vibrate(1);
                  return {
                    progress: animationValue.progress,
                  };
                }
                resolve(parseValue);
                return {};
              }
              reject(new Error('cancel'));
              return {};
            },
          },
        });
      }),
    [navigation, parseQRCode],
  );
  return useMemo(() => ({ start }), [start]);
}
