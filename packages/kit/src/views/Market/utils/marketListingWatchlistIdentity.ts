import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { getDefaultStockTokenVariant } from '../MarketDetailV2/utils/stockTokenVariant';

export type IMarketListingKind = 'asset' | 'stock';

export type IMarketListingWatchlistIdentity = {
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  tokenSymbol: string;
};

// Virtualized rows and Home may request the same listing at the same time.
const limit = pLimit(4);

export const resolveMarketListingWatchlistIdentity = memoizee(
  (kind: IMarketListingKind, id: string) =>
    limit(async (): Promise<IMarketListingWatchlistIdentity | undefined> => {
      let chainId: string | undefined;
      let contractAddress: string | undefined;
      let isNative = false;
      let tokenSymbol: string | undefined;

      if (kind === 'asset') {
        const { asset, selectedVariant } =
          await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
            assetId: id,
            currency: 'usd',
          });
        chainId = selectedVariant?.networkId;
        contractAddress = selectedVariant?.tokenAddress;
        isNative = selectedVariant?.isNative ?? false;
        tokenSymbol = asset.symbol;
      } else {
        const { items, defaultTokenId } =
          await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants(
            {
              stockId: id,
            },
          );
        const variant = getDefaultStockTokenVariant(items, defaultTokenId);
        chainId = variant?.networkId;
        contractAddress = variant?.contractAddress;
        tokenSymbol = variant?.symbol;
      }

      if (
        !chainId ||
        !networkUtils.getLocalNetworkInfo(chainId) ||
        (!isNative && !contractAddress?.trim())
      ) {
        return undefined;
      }

      return {
        chainId,
        contractAddress:
          normalizeTokenContractAddress({
            networkId: chainId,
            contractAddress: contractAddress ?? '',
          }) ?? '',
        isNative,
        tokenSymbol: tokenSymbol ?? '',
      };
    }),
  { promise: true, max: 500, maxAge: 60_000 },
);
