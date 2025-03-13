import { parseUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IQRCodeHandler, IUrlValue } from '../type';

// https://www.google.com/search?q=onekey
const url: IQRCodeHandler<IUrlValue> = async (value) => {
  const urlValue = parseUrl(value);
  if (urlValue) {
    return {
      type: /^https?/i.test(urlValue.urlSchema)
        ? EQRCodeHandlerType.URL
        : EQRCodeHandlerType.UNKNOWN,
      data: urlValue,
    };
  }
  return null;
};

export default url;
