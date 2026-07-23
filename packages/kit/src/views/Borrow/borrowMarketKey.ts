import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

export const buildBorrowMarketKey = (
  market?: Pick<IBorrowMarketItem, 'provider' | 'networkId' | 'marketAddress'>,
) => {
  const networkId = market?.networkId ?? '';
  const marketAddress = market?.marketAddress ?? '';
  const normalizedMarketAddress =
    networkId && marketAddress
      ? earnUtils.normalizeBorrowAddress({
          networkId,
          address: marketAddress,
        })
      : marketAddress;

  return [
    market?.provider?.toLowerCase() ?? '',
    networkId,
    normalizedMarketAddress,
  ].join(':');
};
