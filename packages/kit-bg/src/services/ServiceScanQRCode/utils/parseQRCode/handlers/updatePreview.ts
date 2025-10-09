import {
  WEB_APP_URL,
  WEB_APP_URL_DEV,
  WEB_APP_URL_SHORT,
} from '@onekeyhq/shared/src/config/appConfig';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IBaseValue, IQRCodeHandler } from '../type';

/*
https://app.onekeytest.com/modal/update/preview
*/
const updatePreview: IQRCodeHandler<IBaseValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue?.data?.urlParamList) {
    const origin = urlValue?.data?.origin;
    if (
      [WEB_APP_URL, WEB_APP_URL_DEV, WEB_APP_URL_SHORT].includes(origin) &&
      urlValue?.data?.pathname === '/modal/update/preview'
    ) {
      return {
        type: EQRCodeHandlerType.UPDATE_PREVIEW,
        data: {},
      };
    }
  }
  return null;
};

export default updatePreview;
