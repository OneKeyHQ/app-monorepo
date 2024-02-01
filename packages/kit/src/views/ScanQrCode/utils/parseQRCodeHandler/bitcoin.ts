import { EQRCodeHandlerType } from './type';

import type {
  IBitcoinValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

// btc://5ABC
// bitcoin://5ABC
export const bitcoin: IQRCodeHandler<IBitcoinValue> = (value, options) => {
  const urlValue = options?.urlResult;
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
