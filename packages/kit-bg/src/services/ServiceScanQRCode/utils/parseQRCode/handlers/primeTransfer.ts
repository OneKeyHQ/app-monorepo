import { TRANSFER_DEEPLINK_URL } from '@onekeyhq/shared/src/consts/primeConsts';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IBaseValue, IQRCodeHandlerParseOptions } from '../type';

export interface IPrimeTransferValue extends IBaseValue {
  code: string;
  server?: string;
}

export default async function (
  value: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options?: IQRCodeHandlerParseOptions,
): Promise<{ type: EQRCodeHandlerType; data: IPrimeTransferValue } | null> {
  if (!value || !value.startsWith(`${TRANSFER_DEEPLINK_URL}`)) {
    return null;
  }

  try {
    const parsedUrl = uriUtils.parseUrl(value);
    const code = parsedUrl?.urlParamList?.code;
    const server = parsedUrl?.urlParamList?.server;

    if (!code) {
      return null;
    }

    return {
      type: EQRCodeHandlerType.PRIME_TRANSFER,
      data: {
        code,
        server,
      },
    };
  } catch (error) {
    return null;
  }
}
