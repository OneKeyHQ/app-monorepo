import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, IUrlValue } from '../type';

// onekey://search/list?q=onekey
// onekey-wallet://search/list?q=onekey
export const deeplink: IQRCodeHandler<IUrlValue> = (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue) {
    if (
      ['onekey', 'onekey-wallet'].findIndex(
        (item) => item === urlValue.data.urlSchema,
      ) !== -1
    ) {
      return {
        type: EQRCodeHandlerType.DEEPLINK,
        data: urlValue.data,
      };
    }
  }
  return null;
};
