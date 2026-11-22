// The bounds module alone, so parsing does not pull the whole QR wallet SDK in.
import { UrScanRejectedError } from '@onekeyhq/qr-wallet-sdk/src/boundedUr';
import { OneKeyErrorAirGapInvalidQrCode } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EQRCodeHandlerType,
  PARSE_HANDLER_NAMES,
} from '@onekeyhq/shared/types/qrCode';

import { getParseHandler } from './handlers';
import * as deeplinkHandler from './handlers/deeplink';
import * as urlHandler from './handlers/url';

import type {
  IBaseValue,
  IQRCodeHandlerParse,
  IQRCodeHandlerParseResult,
} from './type';

export const parseQRCode: IQRCodeHandlerParse<IBaseValue> = async (
  value,
  options,
) => {
  const handlerNames = options?.handlers ?? PARSE_HANDLER_NAMES.all;
  let result: IQRCodeHandlerParseResult<IBaseValue> | undefined;
  const urlResult = await urlHandler.default(value);
  const deeplinkResult = await deeplinkHandler.default(value, {
    urlResult,
  });

  for (const handlerName of handlerNames) {
    try {
      const handler = await getParseHandler(handlerName);
      if (handler) {
        const itemResult = await handler(value, {
          ...options,
          urlResult,
          deeplinkResult,
        });
        if (itemResult) {
          result = {
            ...itemResult,
            raw: value,
          };
          break;
        }
      }
    } catch (error) {
      // A code the scan can never accept ends it with a visible error; falling back to UNKNOWN
      // would read as a silent cancel.
      if (error instanceof UrScanRejectedError) {
        throw new OneKeyErrorAirGapInvalidQrCode({ autoToast: true });
      }
      defaultLogger.app.error.log(
        `[ScanQRCode] parse handler failed: ${handlerName}`,
      );
    }
  }
  if (!result) {
    const itemResult = deeplinkResult ??
      urlResult ?? { type: EQRCodeHandlerType.UNKNOWN, data: value };
    result = { ...itemResult, raw: value };
  }
  if (
    !options?.qrWalletScene &&
    result.type !== EQRCodeHandlerType.ANIMATION_CODE
  ) {
    defaultLogger.scanQrCode.parseQrCode.parsedQrCode(result.type);
  }

  return result;
};
