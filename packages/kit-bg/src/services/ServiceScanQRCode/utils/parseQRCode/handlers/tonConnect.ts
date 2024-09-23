import { TON_CONNECT_DEEP_LINK_NAME } from '@onekeyhq/shared/src/consts/deeplinkConsts';

import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, ITonConnectValue } from '../type';

// tc://?v=2&id=f7411222be10f87ac31276301e77b6a6c42f9d34bc161e6b6c6b705e776eb05b&r=%7B%22manifestUrl%22%3A%22https%3A%2F%2Fapp.ston.fi%2Ftonconnect-manifest.json%22%2C%22items%22%3A%5B%7B%22name%22%3A%22ton_addr%22%7D%5D%7D&ret=none

const tonConnect: IQRCodeHandler<ITonConnectValue> = async (value, options) => {
  const urlValue = options?.urlResult;

  if (urlValue && urlValue.data.urlSchema === TON_CONNECT_DEEP_LINK_NAME) {
    const id = urlValue.data.urlParamList.id;
    const r = urlValue.data.urlParamList.r;
    if (!id || !r) return null;
    const tonConnectValue = {
      id,
      v: urlValue.data.urlParamList.v,
      ret: urlValue.data.urlParamList.ret,
      r,
    };
    return {
      type: EQRCodeHandlerType.TON_CONNECT,
      data: tonConnectValue,
    };
  }
  return null;
};

export default tonConnect;
