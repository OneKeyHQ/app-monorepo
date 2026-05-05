import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import type { IQRCodeHandler, ISolanaValue } from '../type';

// oxlint-disable-next-line @cspell/spellchecker
// solana:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH?amount=500&reference=GynvDYDEZXFdGCAH66AWBGVLHgxDK1uTGuCshQWG3FjD&label=1&message=1&memo=%23t9e4m

// https://github.com/anza-xyz/solana-pay/blob/master/SPEC.md
const solana: IQRCodeHandler<ISolanaValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /solana/i.test(urlValue.data.urlSchema)) {
    const solanaValue = urlValue.data.urlParamList;

    // oxlint-disable-next-line @cspell/spellchecker
    solanaValue.splToken = solanaValue['spl-token'];
    solanaValue.recipient = urlValue.data.urlPathList[0];
    return {
      type: EQRCodeHandlerType.SOLANA,
      data: {
        ...solanaValue,
        tokenAddress: solanaValue.splToken,
        network: await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
          networkId: getNetworkIdsMap().sol,
        }),
        address: solanaValue.recipient,
      },
    };
  }
  return null;
};

export default solana;
