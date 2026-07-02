import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

import { markMarketPerf } from './marketPerf';

type IMarketTokenListResponseWithSource = IMarketTokenListResponse & {
  __fromSeed?: boolean;
};

type IOneKeyBootstrapData = {
  marketHomeTokenListSeed?: IMarketTokenListResponse;
};

type IGlobalWithOneKeyBootstrapData = typeof globalThis & {
  __ONEKEY_BOOTSTRAP_DATA__?: IOneKeyBootstrapData;
};

// Web HTML injects this generic bootstrap payload before app bundles so Market
// can paint the first token list without an extra cold-start seed request.
const ONEKEY_BOOTSTRAP_DATA_GLOBAL = '__ONEKEY_BOOTSTRAP_DATA__';

const shouldUseMarketHomeTokenListBootstrapSeed = () =>
  platformEnv.isWeb && process.env.NODE_ENV === 'production';

let marketHomeTokenListSeedPromise:
  | Promise<IMarketTokenListResponseWithSource>
  | undefined;

function readMarketHomeTokenListBootstrapSeed():
  | IMarketTokenListResponseWithSource
  | undefined {
  const bootstrapData = (globalThis as IGlobalWithOneKeyBootstrapData)[
    ONEKEY_BOOTSTRAP_DATA_GLOBAL
  ];
  const data = bootstrapData?.marketHomeTokenListSeed;
  if (!data || !Array.isArray(data.list) || data.list.length === 0) {
    return undefined;
  }
  delete bootstrapData.marketHomeTokenListSeed;

  return {
    list: data.list,
    total: data.total,
    __fromSeed: true,
  };
}

const fetchMarketHomeTokenListSeed =
  async (): Promise<IMarketTokenListResponseWithSource> => {
    marketHomeTokenListSeedPromise ??= (async () => {
      markMarketPerf('market-light-api-token-list-seed-start');
      const data = readMarketHomeTokenListBootstrapSeed();
      if (!data) {
        throw new OneKeyLocalError('Market token bootstrap seed is missing');
      }

      return data;
    })()
      .then((data) => {
        markMarketPerf('market-light-api-token-list-seed-end', {
          count: data.list.length,
          source: 'bootstrap',
        });
        return data;
      })
      .catch((error) => {
        marketHomeTokenListSeedPromise = undefined;
        throw error;
      });

    return marketHomeTokenListSeedPromise;
  };

const preloadMarketHomeTokenListSeed = () => {
  if (!shouldUseMarketHomeTokenListBootstrapSeed()) {
    return;
  }
  markMarketPerf('market-light-api-token-list-seed-preload');
  void fetchMarketHomeTokenListSeed().catch(() => undefined);
};

export {
  fetchMarketHomeTokenListSeed,
  preloadMarketHomeTokenListSeed,
  shouldUseMarketHomeTokenListBootstrapSeed,
};
export type { IMarketTokenListResponseWithSource };
