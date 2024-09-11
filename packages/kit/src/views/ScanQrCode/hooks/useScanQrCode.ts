import { useCallback, useMemo } from 'react';

import { Vibration } from 'react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PARSE_HANDLER_NAMES } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/handlers';
import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseOutsideOptions,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { EQRCodeHandlerType } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
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
      handlers,
      account,
      tokens,
      qrWalletScene = false,
      showProTutorial = false,
    }: IQRCodeHandlerParseOutsideOptions) =>
      new Promise<IQRCodeHandlerParseResult<IBaseValue>>((resolve, reject) => {
        void backgroundApiProxy.serviceScanQRCode.resetAnimationData();

        navigation.pushModal(EModalRoutes.ScanQrCodeModal, {
          screen: EScanQrCodeModalPages.ScanQrCodeStack,
          params: {
            qrWalletScene,
            showProTutorial,
            callback: async (value: string) => {
              if (value?.length > 0) {
                const parseValue = await parseQRCode.parse(value, {
                  autoHandleResult,
                  handlers,
                  account,
                  tokens,
                });
                if (parseValue.type === EQRCodeHandlerType.ANIMATION_CODE) {
                  const animationValue = parseValue.data as IAnimationValue;
                  if (animationValue.fullData) {
                    parseValue.raw = animationValue.fullData;
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
              reject(new OneKeyErrorScanQrCodeCancel());
              return {};
            },
          },
        });
      }),
    [navigation, parseQRCode],
  );
  return useMemo(() => ({ start, PARSE_HANDLER_NAMES }), [start]);
}
