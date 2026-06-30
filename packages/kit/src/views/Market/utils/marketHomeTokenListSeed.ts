import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

import { markMarketPerf } from './marketPerf';

type IMarketTokenListResponseWithSource = IMarketTokenListResponse & {
  __fromSeed?: boolean;
};

const MARKET_HOME_TOKEN_LIST_SEED_URL =
  '/static/market-home-token-seed-v1.json';

const shouldUseMarketHomeTokenListSeedFile = () =>
  platformEnv.isWeb && process.env.NODE_ENV === 'production';

let marketHomeTokenListSeedPromise:
  | Promise<IMarketTokenListResponseWithSource>
  | undefined;

const fetchMarketHomeTokenListSeed =
  async (): Promise<IMarketTokenListResponseWithSource> => {
    marketHomeTokenListSeedPromise ??= (async () => {
      markMarketPerf('market-light-api-token-list-seed-start');
      return fetch(MARKET_HOME_TOKEN_LIST_SEED_URL, {
        cache: 'force-cache',
      });
    })()
      .then(async (response) => {
        if (!response.ok) {
          throw new OneKeyLocalError(
            `Market token seed failed: ${response.status}`,
          );
        }
        const data = (await response.json()) as IMarketTokenListResponse;
        markMarketPerf('market-light-api-token-list-seed-end', {
          count: data.list.length,
        });
        return {
          list: data.list,
          total: data.total,
          __fromSeed: true,
        };
      })
      .catch((error) => {
        marketHomeTokenListSeedPromise = undefined;
        throw error;
      });

    return marketHomeTokenListSeedPromise;
  };

const preloadMarketHomeTokenListSeed = () => {
  if (!shouldUseMarketHomeTokenListSeedFile()) {
    return;
  }
  markMarketPerf('market-light-api-token-list-seed-preload');
  void fetchMarketHomeTokenListSeed().catch(() => undefined);
};

export {
  fetchMarketHomeTokenListSeed,
  preloadMarketHomeTokenListSeed,
  shouldUseMarketHomeTokenListSeedFile,
};
export type { IMarketTokenListResponseWithSource };
