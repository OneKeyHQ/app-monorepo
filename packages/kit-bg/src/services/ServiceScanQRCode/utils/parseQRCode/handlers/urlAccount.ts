import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
} from '@onekeyhq/shared/src/config/appConfig';

import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, IUrlAccountValue } from '../type';

/*
https://wallet.onekeytest.com/btc/3EuKgMjxH8t3zEpMoobSeofXzQ64u2Sfpi
*/
export const urlAccount: IQRCodeHandler<IUrlAccountValue> = async (
  value,
  options,
) => {
  const urlValue = options?.urlResult;
  // const deeplinkValue = options?.deeplinkResult;
  // if (
  //   deeplinkValue &&
  //   deeplinkValue.data.urlPathList?.[0] === WALLET_CONNECT_DEEP_LINK_NAME
  // ) {
  //   urlValue = await urlHandler.url(
  //     deeplinkValue.data.urlParamList?.uri,
  //     options,
  //   );
  // }

  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    if ([WEB_APP_URL, WEB_APP_URL_DEV].includes(origin)) {
      const [networkId, address] = urlValue?.data?.urlPathList?.slice(1) || [];
      const network =
        await options?.backgroundApi?.serviceNetwork.getNetworkSafe({
          networkId,
          code: networkId,
        });
      if (network) {
        return {
          type: EQRCodeHandlerType.URL_ACCOUNT,
          data: {
            origin,
            networkId,
            address,
          },
        };
      }
    }
  }
  return null;
};
