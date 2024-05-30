import { PARSE_HANDLERS } from './handlers';
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
  const handlers = options?.handlers ?? PARSE_HANDLERS.all;
  let result: IQRCodeHandlerParseResult<IBaseValue> | undefined;
  const urlResult = await urlHandler.default(value);
  const deeplinkResult = await deeplinkHandler.default(value, {
    urlResult,
  });

  for (const handler of Object.values(handlers)) {
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
