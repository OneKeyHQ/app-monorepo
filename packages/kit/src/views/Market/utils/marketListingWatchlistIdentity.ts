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

export const resolveMarketListingWatchlistIdentity = memoizee(
  async (
    kind: IMarketListingKind,
    id: string,
  ): Promise<IMarketListingWatchlistIdentity | undefined> => {
    let chainId: string | undefined;
    let contractAddress: string | undefined;
    let isNative = false;
    let tokenSymbol: string | undefined;

    if (kind === 'asset') {
      const { asset, selectedVariant } =
        await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
          assetId: id,
          currency: 'usd',
          autoHandleError: false,
        });
      chainId = selectedVariant?.networkId;
      contractAddress = selectedVariant?.tokenAddress;
      isNative = selectedVariant?.isNative ?? false;
      tokenSymbol = asset.symbol;
    } else {
      const { items, defaultTokenId } =
        await backgroundApiProxy.serviceMarketV2.fetchMarketStockTokenVariants({
          stockId: id,
        });
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
  },
  { promise: true, max: 500, maxAge: 60_000 },
);

type IIdentityRequest = {
  users: number;
  started: boolean;
  promise: Promise<IMarketListingWatchlistIdentity | undefined>;
};

const limit = pLimit(4);
const requests = new Map<string, IIdentityRequest>();

export function acquireMarketListingWatchlistIdentity(
  kind: IMarketListingKind,
  id: string,
) {
  const key = `${kind}:${id}`;
  let request = requests.get(key);
  if (!request) {
    const pending: IIdentityRequest = {
      users: 0,
      started: false,
      promise: limit(async () => {
        // Skip abandoned work before making a request or populating the cache.
        if (!pending.users) {
          return undefined;
        }
        pending.started = true;
        return resolveMarketListingWatchlistIdentity(kind, id);
      }).finally(() => {
        if (requests.get(key) === pending) {
          requests.delete(key);
        }
      }),
    };
    requests.set(key, pending);
    request = pending;
  }
  const current = request;
  current.users += 1;
  let released = false;
  return {
    promise: current.promise,
    release: () => {
      if (released) {
        return;
      }
      released = true;
      current.users -= 1;
      // Keep in-flight work shared; a later mount can subscribe to its result.
      if (!current.users && !current.started && requests.get(key) === current) {
        requests.delete(key);
      }
    },
  };
}
