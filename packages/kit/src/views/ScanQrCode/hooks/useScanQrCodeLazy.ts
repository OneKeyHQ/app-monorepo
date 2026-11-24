import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Haptics,
  ImpactFeedbackStyle,
  rootNavigationRef,
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
import {
  isInvalidQrCodeError,
  isRetryableQrParseFailure,
} from '../utils/isInvalidQrCodeError';

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
      scanRequestId,
    }: IQRCodeHandlerParseOutsideOptions & { scanRequestId?: string }) => {
      const parseQRCodeModulePromise = import('./useParseQRCode');
      const result = await new Promise<IQRCodeHandlerParseResult<IBaseValue>>(
        (resolve, reject) => {
          void backgroundApiProxy.serviceScanQRCode.resetAnimationData();

          navigation.pushModal(EModalRoutes.ScanQrCodeModal, {
            screen: EScanQrCodeModalPages.ScanQrCodeStack,
            params: {
              qrWalletScene,
              showProTutorial,
              scanRequestId,
              onCancel: () => reject(new OneKeyErrorScanQrCodeCancel()),
              callback: async ({
                value,
                popNavigation,
                routeKey,
                onResultDismiss,
              }) => {
                const { parseQRCodeWithDeps } = await parseQRCodeModulePromise;
                if (
                  popNavigation &&
                  rootNavigationRef.current?.getCurrentRoute()?.key !== routeKey
                ) {
                  return { retry: true };
                }
                let parseValue: IQRCodeHandlerParseResult<IBaseValue>;
                try {
                  parseValue = await parseQRCodeWithDeps(
                    value,
                    {
                      autoExecuteParsedAction,
                      handlers,
                      account,
                      network,
                      tokens,
                      popNavigation,
                    },
                    {
                      navigation,
                      clipboard,
                      intl,
                      scanRequestId,
                      scanRouteKey: routeKey,
                      onResultDismiss,
                    },
                  );
                } catch (error) {
                  // A transient parse failure retries the frame; an action error stays
                  // a dropped frame, as before. The page stays open for both.
                  if (
                    error instanceof OneKeyErrorScanQrCodeCancel ||
                    isRetryableQrParseFailure(error)
                  ) {
                    return { retry: true };
                  }
                  if (!isInvalidQrCodeError(error)) throw error;
                  reject(error);
                  return {};
                }
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
