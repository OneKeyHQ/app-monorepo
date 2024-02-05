import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, IWalletConnectValue } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
/* 
version-2
wc:6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe@2?relay-protocol=irn&symKey=99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355
*/

// eslint-disable-next-line spellcheck/spell-checker
/*
version-1
wc:7a2eabf0-a5ab-4df5-805c-1bf50da956c7@1?bridge=https%3A%2F%2Fx.bridge.walletconnect.org&key=a1bc7b3461fc0c017288c06bbfddd4d00fa187409821b3f909f2125b33277e0d
*/
export const walletConnect: IQRCodeHandler<IWalletConnectValue> = async (
  value,
  options,
) => {
  const urlValue = options?.urlResult;
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
      return {
        type: EQRCodeHandlerType.WALLET_CONNECT,
        data: walletConnectValue,
      };
    }
  }
  return null;
};
