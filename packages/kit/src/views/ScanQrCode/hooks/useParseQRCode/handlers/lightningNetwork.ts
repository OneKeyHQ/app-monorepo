import bech32 from 'bech32';

import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type {
  ILightningNetworkValue,
  IQRCodeHandler,
  IQRCodeHandlerResult,
} from './type';

export const lightningNetwork: IQRCodeHandler<ILightningNetworkValue> = (
  value,
  options,
) => {
  let result: IQRCodeHandlerResult<ILightningNetworkValue> = null;
  if (/^LNURL1/i.test(value)) {
    const { words: data } = bech32.decode(value, 2000);
    const byteData = bech32.fromWords(data);
    const decodeValue = Buffer.from(byteData).toString('utf-8');
    const urlValue = urlHandler(decodeValue, options);

    if (urlValue) {
      const lightningNetworkValue = {
        tag: urlValue.data.urlParamList.tag,
        k1: urlValue.data.urlParamList.k1,
      };
      result = {
        type: EQRCodeHandlerType.LIGHTNING_NETWORK,
        data: lightningNetworkValue,
      };
    }
  }
  return result;
};
