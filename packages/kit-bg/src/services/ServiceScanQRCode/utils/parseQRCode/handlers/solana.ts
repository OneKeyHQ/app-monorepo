import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { EQRCodeHandlerType } from '../type';

import type { IQRCodeHandler, ISolanaValue } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
// solana:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH?amount=500&reference=GynvDYDEZXFdGCAH66AWBGVLHgxDK1uTGuCshQWG3FjD&label=1&message=1&memo=%23t9e4m

// https://github.com/anza-xyz/solana-pay/blob/master/SPEC.md
export const solana: IQRCodeHandler<ISolanaValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /solana/i.test(urlValue.data.urlSchema)) {
    const solanaValue = urlValue.data.urlParamList;
    // eslint-disable-next-line spellcheck/spell-checker
    solanaValue.spl_token = solanaValue['spl-token'];
    solanaValue.recipient = urlValue.data.urlPathList[0];
    return {
      type: EQRCodeHandlerType.SOLANA,
      data: {
        ...solanaValue,
        network: await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
          networkId: getNetworkIdsMap().sol,
        }),
        address: solanaValue.recipient,
      },
    };
  }
  return null;
};
