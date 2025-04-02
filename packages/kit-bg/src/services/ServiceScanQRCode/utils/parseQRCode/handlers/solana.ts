import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { isPayUrl, parsePayUrl } from './utils';

import type { IQRCodeHandler, ISolanaValue } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
// solana:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH?amount=500&reference=GynvDYDEZXFdGCAH66AWBGVLHgxDK1uTGuCshQWG3FjD&label=1&message=1&memo=%23t9e4m

// https://github.com/anza-xyz/solana-pay/blob/master/SPEC.md
const solana: IQRCodeHandler<ISolanaValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /solana/i.test(urlValue.data.urlSchema)) {
    if (isPayUrl(urlValue.data.url)) {
      const result = parsePayUrl(urlValue.data.url);
      if (result) {
        const { address, targetAddress } = result;
        return {
          type: EQRCodeHandlerType.SOLANA,
          data: {
            network: await options?.backgroundApi?.serviceNetwork?.getNetwork?.(
              {
                networkId: getNetworkIdsMap().sol,
              },
            ),
            address,
            targetAddress,
          },
        };
      }
    }
    const solanaValue = urlValue.data.urlParamList;
    // eslint-disable-next-line spellcheck/spell-checker
    solanaValue.splToken = solanaValue['spl-token'];
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

export default solana;
