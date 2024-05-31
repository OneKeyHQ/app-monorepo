import { PARSE_HANDLERS, PARSE_HANDLER_NAMES } from './handlers';
import * as deeplinkHandler from './handlers/deeplink';
import * as urlHandler from './handlers/url';
import { EQRCodeHandlerType } from './type';

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
    const handler = PARSE_HANDLERS[handlerName];
    try {
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
    } catch (e) {
      console.warn('parse next', e);
    }
  }
  if (!result) {
    const itemResult = deeplinkResult ??
      urlResult ?? { type: EQRCodeHandlerType.UNKNOWN, data: value };
    result = { ...itemResult, raw: value };
  }
  return result;
};
