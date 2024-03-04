import { WALLET_CONNECT_DEEP_LINK_NAME } from '@onekeyhq/shared/src/consts/deeplinkConsts';

import { EQRCodeHandlerType } from '../type';

import * as urlHandler from './url';

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

// eslint-disable-next-line spellcheck/spell-checker
// onekey-wallet://wc?uri=wc%3A6b18a69c27df54b4c228e0ff60218ba460a4994aa5775963f6f0ee354b629afe%402%3Frelay-protocol%3Dirn%26symKey%3D99f6e5fa2bda94c704be8d7adbc2643b861ef49dbe09e0af26d3713e219b4355
export const walletConnect: IQRCodeHandler<IWalletConnectValue> = async (
  value,
  options,
) => {
  let urlValue = options?.urlResult;
  const deeplinkValue = options?.deeplinkResult;
  if (
    deeplinkValue &&
    deeplinkValue.data.urlPathList?.[0] === WALLET_CONNECT_DEEP_LINK_NAME
  ) {
    urlValue = await urlHandler.url(
      deeplinkValue.data.urlParamList?.uri,
      options,
    );
  }

  if (
    urlValue &&
    [WALLET_CONNECT_DEEP_LINK_NAME].findIndex(
      (item) => item === urlValue?.data.urlSchema,
    ) !== -1
  ) {
    const pathList = urlValue.data.urlPathList?.[0].split('@');
    const walletConnectValue = {
      version: pathList?.[1],
      wcUri: urlValue.data.url,
    };
    return {
      type: EQRCodeHandlerType.WALLET_CONNECT,
      data: walletConnectValue,
    };
  }
  return null;
};
