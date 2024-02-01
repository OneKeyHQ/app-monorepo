import { EQRCodeHandlerType } from './type';

import type { IQRCodeHandler, IQRCodeHandlerResult, IUrlValue } from './type';

// https://www.google.com/search?q=onekey
export const url: IQRCodeHandler<IUrlValue> = (value) => {
  let result: IQRCodeHandlerResult<IUrlValue>;
  try {
    const urlObject = new URL(value);
    const urlValue = {
      urlSchema: urlObject.protocol.replace(/(:)$/, ''),
      urlPathList: `${urlObject.hostname}${urlObject.pathname}`
        .replace(/^\/\//, '')
        .split('/')
        .filter((x) => x?.length > 0),
      urlParamList: Array.from(urlObject.searchParams.entries()).reduce<{
        [key: string]: any;
      }>((paramList, [paramKey, paramValue]) => {
        paramList[paramKey] = paramValue;
        return paramList;
      }, {}),
    };
    result = { type: EQRCodeHandlerType.URL, data: urlValue };
  } catch (e) {
    result = null;
  }
  return result;
};
