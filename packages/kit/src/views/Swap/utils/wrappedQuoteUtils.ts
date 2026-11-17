import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IFetchQuoteResult,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

const WRAPPED_PROVIDER_NAME = 'Wrap Contract';
const WRAPPED_INSTANT_RATE = '1';

export function buildWrappedSwapQuoteResult({
  fromToken,
  toToken,
  amount,
  providerLogo,
}: {
  fromToken: ISwapTokenBase;
  toToken: ISwapTokenBase;
  amount: string;
  providerLogo?: string;
}): IFetchQuoteResult {
  return {
    quoteId: generateUUID(),
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'wrapped',
      providerName: WRAPPED_PROVIDER_NAME,
      providerLogo,
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: amount,
    toAmount: amount,
    instantRate: WRAPPED_INSTANT_RATE,
    isWrapped: true,
    fee: {
      percentageFee: 0,
    },
  };
}
