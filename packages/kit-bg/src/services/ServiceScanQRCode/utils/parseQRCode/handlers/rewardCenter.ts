import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
  WEB_APP_URL_SHORT,
} from '@onekeyhq/shared/src/config/appConfig';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IBaseValue, IQRCodeHandler } from '../type';

/*
https://app.onekeytest.com/reward-center
*/
const rewardCenter: IQRCodeHandler<IBaseValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    if (
      [WEB_APP_URL, WEB_APP_URL_DEV, WEB_APP_URL_SHORT].includes(origin) &&
      urlValue?.data?.pathname === '/reward-center'
    ) {
      return {
        type: EQRCodeHandlerType.REWARD_CENTER,
        data: {},
      };
    }
  }
  return null;
};

export default rewardCenter;
