import * as handlers from './handlers';
import * as deeplinkHandler from './handlers/deeplink';
import * as urlHandler from './handlers/url';
import { EQRCodeHandlerType } from './type';

import type {
  IBaseValue,
  IQRCodeHandler,
  IQRCodeHandlerParse,
  IQRCodeHandlerParseResult,
} from './type';

const handlerList = handlers as Record<string, IQRCodeHandler<IBaseValue>>;

export const parseQRCode: IQRCodeHandlerParse<IBaseValue> = (
  value,
  options,
) => {
  let result: IQRCodeHandlerParseResult<IBaseValue> | undefined;
  const urlResult = urlHandler.url(value);
  const deeplinkResult = deeplinkHandler.deeplink(value, { urlResult });
  for (const handler of Object.values(handlerList)) {
    try {
      const itemResult = handler(value, {
        ...options,
        urlResult,
        deeplinkResult,
      });
      if (itemResult) {
        result = {
          type: itemResult.type,
          data: itemResult.data,
          raw: value,
        };
        break;
      }
    } catch (e) {
      console.log('parse next');
    }
  }
  if (!result) {
    const itemResult = deeplinkResult ??
      urlResult ?? { type: EQRCodeHandlerType.UNKNOWN, data: value };
    result = { ...itemResult, raw: value };
  }
  return result;
};
