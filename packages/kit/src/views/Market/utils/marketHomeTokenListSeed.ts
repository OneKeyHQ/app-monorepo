import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

import { markMarketPerf } from './marketPerf';

type IMarketTokenListResponseWithSource = IMarketTokenListResponse & {
  __fromSeed?: boolean;
  __fromColdCacheFallback?: boolean;
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

let marketHomeTokenListSeedConsumed = false;

const shouldUseMarketHomeTokenListBootstrapSeed = () =>
  platformEnv.isWeb &&
  process.env.NODE_ENV === 'production' &&
  !marketHomeTokenListSeedConsumed;

let marketHomeTokenListSeedPromise:
  | Promise<IMarketTokenListResponseWithSource>
  | undefined;
let marketHomeTokenListSeedSnapshot:
  | IMarketTokenListResponseWithSource
  | undefined;

function readMarketHomeTokenListBootstrapSeed():
  | IMarketTokenListResponseWithSource
  | undefined {
  const bootstrapData = (globalThis as IGlobalWithOneKeyBootstrapData)[
    ONEKEY_BOOTSTRAP_DATA_GLOBAL
  ];
  if (!bootstrapData) {
    return undefined;
  }
  const data = bootstrapData.marketHomeTokenListSeed;
  if (!data || !Array.isArray(data.list) || data.list.length === 0) {
    return undefined;
  }
  delete bootstrapData.marketHomeTokenListSeed;

  const seed = {
    list: data.list,
    total: data.total,
    __fromSeed: true,
  };
  marketHomeTokenListSeedSnapshot = seed;
  return seed;
}

function getMarketHomeTokenListSeedPromise() {
  marketHomeTokenListSeedPromise ??= (async () => {
    markMarketPerf('market-light-api-token-list-seed-start');
    const data =
      marketHomeTokenListSeedSnapshot ?? readMarketHomeTokenListBootstrapSeed();
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
      marketHomeTokenListSeedSnapshot = undefined;
      throw error;
    });

  return marketHomeTokenListSeedPromise;
}

const fetchMarketHomeTokenListSeed = async ({
  consume = true,
}: {
  consume?: boolean;
} = {}): Promise<IMarketTokenListResponseWithSource> => {
  if (marketHomeTokenListSeedConsumed) {
    throw new OneKeyLocalError('Market token bootstrap seed was consumed');
  }

  const seedPromise = getMarketHomeTokenListSeedPromise();
  if (!consume) {
    return seedPromise;
  }

  marketHomeTokenListSeedConsumed = true;
  try {
    return await seedPromise;
  } finally {
    marketHomeTokenListSeedPromise = undefined;
    marketHomeTokenListSeedSnapshot = undefined;
  }
};

const getMarketHomeTokenListSeedForInit = () => {
  if (!shouldUseMarketHomeTokenListBootstrapSeed()) {
    return undefined;
  }

  return (
    marketHomeTokenListSeedSnapshot ?? readMarketHomeTokenListBootstrapSeed()
  );
};

const preloadMarketHomeTokenListSeed = () => {
  if (!shouldUseMarketHomeTokenListBootstrapSeed()) {
    return;
  }
  markMarketPerf('market-light-api-token-list-seed-preload');
  void fetchMarketHomeTokenListSeed({ consume: false }).catch(() => undefined);
};

export {
  fetchMarketHomeTokenListSeed,
  getMarketHomeTokenListSeedForInit,
  preloadMarketHomeTokenListSeed,
  shouldUseMarketHomeTokenListBootstrapSeed,
};
export type { IMarketTokenListResponseWithSource };
