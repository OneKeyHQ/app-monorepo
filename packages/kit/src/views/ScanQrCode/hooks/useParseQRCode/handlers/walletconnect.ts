import { EQRCodeHandlerType } from './type';
import { url as urlHandler } from './url';

import type {
  IQRCodeHandler,
  IQRCodeHandlerResult,
  IWalletConnectValue,
} from './type';

export const walletConnect: IQRCodeHandler<IWalletConnectValue> = (
  value,
  options,
) => {
  const urlValue = urlHandler(value, options);
  let result: IQRCodeHandlerResult<IWalletConnectValue> = null;
  if (urlValue) {
    if (['wc'].findIndex((item) => item === urlValue.data.urlSchema) !== -1) {
      const pathList = urlValue.data.urlPathList?.[0].split('@');
      const walletConnectValue = {
        topic: pathList?.[0],
        version: pathList?.[1],
        bridge: urlValue.data.urlParamList.bridge,
        key: urlValue.data.urlParamList.key,
        symKey: urlValue.data.urlParamList.symKey,
        relayProtocol: urlValue.data.urlParamList['relay-protocol'],
      };
      result = {
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: walletConnectValue,
      };
    }
  }
  return result;
};
