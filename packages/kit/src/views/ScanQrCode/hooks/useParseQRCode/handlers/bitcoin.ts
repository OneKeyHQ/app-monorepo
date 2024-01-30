import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type {
  IBitcoinValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

export const bitcoin: IQRCodeHandler<IBitcoinValue> = (value, options) => {
  const urlValue = urlHandler(value, options);
  let result: IQRCodeHandlerResult<IBitcoinValue> = null;
  if (urlValue) {
    if (
      ['btc', 'bitcoin'].findIndex(
        (item) => item === urlValue.data.urlSchema,
      ) !== -1
    ) {
      const bitcoinValue = { address: urlValue.data.urlPathList?.[0] };
      result = {
        type: EQRCodeHandlerType.BITCOIN,
        data: bitcoinValue,
      };
    }
  }
  return result;
};
