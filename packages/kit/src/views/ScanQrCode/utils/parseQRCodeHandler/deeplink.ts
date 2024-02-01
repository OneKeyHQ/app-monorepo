import { EQRCodeHandlerType } from './type';

import type { IQRCodeHandler, IQRCodeHandlerResult, IUrlValue } from './type';

// onekey://search/list?q=onekey
// onekey-wallet://search/list?q=onekey
export const deeplink: IQRCodeHandler<IUrlValue> = (value, options) => {
  const urlValue = options?.urlResult;
  let result: IQRCodeHandlerResult<IUrlValue> = null;
  if (urlValue) {
    if (
      ['onekey', 'onekey-wallet'].findIndex(
        (item) => item === urlValue.data.urlSchema,
      ) !== -1
    ) {
      result = {
        type: EQRCodeHandlerType.DEEPLINK,
        data: urlValue.data,
      };
    }
  }
  return result;
};
