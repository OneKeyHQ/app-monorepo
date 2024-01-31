import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type {
  IEthereumValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

// eth://0x5ABC
// ethereum://0x5ABC
export const ethereum: IQRCodeHandler<IEthereumValue> = (value, options) => {
  const urlValue = urlHandler(value, options);
  let result: IQRCodeHandlerResult<IEthereumValue> = null;
  if (urlValue) {
    if (
      ['eth', 'ethereum'].findIndex(
        (item) => item === urlValue.data.urlSchema,
      ) !== -1
    ) {
      const ethereumValue = { address: urlValue.data.urlPathList?.[0] };
      result = {
        type: EQRCodeHandlerType.ETHEREUM,
        data: ethereumValue,
      };
    }
  }
  return result;
};
