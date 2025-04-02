import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import { parsePayUrl } from './utils';

import type { IQRCodeHandler, ISuiValue } from '../type';

// eslint-disable-next-line spellcheck/spell-checker
// solana:HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH?amount=500&reference=GynvDYDEZXFdGCAH66AWBGVLHgxDK1uTGuCshQWG3FjD&label=1&message=1&memo=%23t9e4m

// https://github.com/anza-xyz/solana-pay/blob/master/SPEC.md
const sui: IQRCodeHandler<ISuiValue> = async (value, options) => {
  const urlValue = options?.urlResult;
  if (urlValue && /sui/i.test(urlValue.data.urlSchema)) {
    const { address, targetAddress } = parsePayUrl(urlValue.data.url);
    return {
      type: EQRCodeHandlerType.SUI,
      data: {
        network: await options?.backgroundApi?.serviceNetwork?.getNetwork?.({
          networkId: getNetworkIdsMap().sui,
        }),
        address,
        targetAddress,
      },
    };
  }
  return null;
};

export default sui;
