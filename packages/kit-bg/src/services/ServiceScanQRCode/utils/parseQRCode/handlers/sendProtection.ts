import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IBaseValue, IQRCodeHandler } from '../type';

/*
https://app.onekeytest.com/market/tokens/bitcoin
*/
const sendProtection: IQRCodeHandler<IBaseValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    if (
      [WEB_APP_URL, WEB_APP_URL_DEV].includes(origin) &&
      urlValue?.data?.pathname === '/send/protection'
    ) {
      return {
        type: EQRCodeHandlerType.SEND_PROTECTION,
        data: {},
      };
    }
  }
  return null;
};

export default sendProtection;
