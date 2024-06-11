import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

import { EQRCodeHandlerType } from '../type';

import type { IMarketDetailValue, IQRCodeHandler } from '../type';

/*
https://app.onekeytest.com/market/market_detail?coinGeckoId=bitcoin
*/
const marketDetail: IQRCodeHandler<IMarketDetailValue> = async (
  value,
  options,
) => {
  const urlValue = options?.urlResult;
  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    if (
      [WEB_APP_URL, WEB_APP_URL_DEV].includes(origin) &&
      urlValue?.data?.pathname === '/market/market_detail' &&
      urlValue?.data?.urlParamList
    ) {
      const { coinGeckoId } = urlValue.data.urlParamList;
      return {
        type: EQRCodeHandlerType.MARKET_DETAIL,
        data: {
          origin,
          coinGeckoId,
        },
      };
    }
  }
  return null;
};

export default marketDetail;
