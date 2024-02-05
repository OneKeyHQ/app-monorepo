import { parseUrl } from '@onekeyhq/shared/src/utils/uriUtils';

import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, IUrlValue } from '../type';

// https://www.google.com/search?q=onekey
export const url: IQRCodeHandler<IUrlValue> = async (value) => {
  const urlValue = parseUrl(value);
  if (urlValue) {
    return { type: EQRCodeHandlerType.URL, data: urlValue };
  }
  return null;
};
