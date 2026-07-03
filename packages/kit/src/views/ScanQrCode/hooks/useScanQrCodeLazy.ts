import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Haptics,
  ImpactFeedbackStyle,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IAnimationValue,
  IBaseValue,
  IQRCodeHandlerParseOutsideOptions,
  IQRCodeHandlerParseResult,
} from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/type';
import { OneKeyErrorScanQrCodeCancel } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EScanQrCodeModalPages,
} from '@onekeyhq/shared/src/routes';
import {
  EQRCodeHandlerType,
  PARSE_HANDLER_NAMES,
} from '@onekeyhq/shared/types/qrCode';

import useAppNavigation from '../../../hooks/useAppNavigation';

export default function useScanQrCodeLazy() {
  const navigation = useAppNavigation();
  const clipboard = useClipboard();
  const intl = useIntl();

  const start = useCallback(
    async ({
      autoExecuteParsedAction = false,
      handlers,
      account,
      network,
      tokens,
      qrWalletScene = false,
      showProTutorial = false,
    }: IQRCodeHandlerParseOutsideOptions) => {
      const parseQRCodeModulePromise = import('./useParseQRCode');
      const result = await new Promise<IQRCodeHandlerParseResult<IBaseValue>>(
        (resolve, reject) => {
          void backgroundApiProxy.serviceScanQRCode.resetAnimationData();

          navigation.pushModal(EModalRoutes.ScanQrCodeModal, {
            screen: EScanQrCodeModalPages.ScanQrCodeStack,
            params: {
              qrWalletScene,
              showProTutorial,
              callback: async ({ value, popNavigation }) => {
                if (value?.length > 0) {
                  const { parseQRCodeWithDeps } =
                    await parseQRCodeModulePromise;
                  const parseValue = await parseQRCodeWithDeps(
                    value,
                    {
                      autoExecuteParsedAction,
                      handlers,
                      account,
                      network,
                      tokens,
                      popNavigation,
                    },
                    { navigation, clipboard, intl },
                  );
                  if (parseValue.type === EQRCodeHandlerType.ANIMATION_CODE) {
                    const animationValue = parseValue.data as IAnimationValue;
                    if (animationValue.fullData) {
                      parseValue.raw = animationValue.fullData;
                      resolve(parseValue);
                    }
                    Haptics.impact(ImpactFeedbackStyle.Light);
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
        },
      );
      return result;
    },
    [navigation, clipboard, intl],
  );
  return useMemo(() => ({ start, PARSE_HANDLER_NAMES }), [start]);
}
