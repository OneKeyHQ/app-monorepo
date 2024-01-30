import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type { IQRCodeHandler, IQRCodeHandlerResult, IUrlValue } from './type';

export const deeplink: IQRCodeHandler<IUrlValue> = (value, options) => {
  const urlValue = urlHandler(value, options);
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
