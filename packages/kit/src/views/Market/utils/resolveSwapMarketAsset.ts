import pLimit from 'p-limit';
import pTimeout from 'p-timeout';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { resolveMarketAssetVariant } from '@onekeyhq/shared/src/utils/marketAssetVariant';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

import { getMarketTopCoinsRequestType } from '../MarketHomeV2/components/MarketTopCoinsList/marketTopCoinsCategoryUtils';

const TIMEOUT = 10_000;
const CONCURRENCY = 8;

export async function resolveSwapMarketAsset(
  token: {
    networkId: string;
    tokenAddress: string;
    symbol: string;
    isNative: boolean;
  },
  signal: AbortSignal,
) {
  const { serviceMarket, serviceMarketV2 } = backgroundApiProxy;
  const timeout = <T>(promise: Promise<T>, milliseconds = TIMEOUT) =>
    pTimeout(promise, { milliseconds });
  const search = token.isNative ? token.symbol : token.tokenAddress;
  const searchResults = search
    ? await timeout(
        serviceMarket.searchV2Token(search, {
          autoHandleError: false,
          resolveNativeAssetId: false,
        }),
        2000,
      ).catch(() => [])
    : [];
  const matchingSearchResults = searchResults.filter(
    (item) =>
      item &&
      item.network === token.networkId &&
      item.isNative === token.isNative &&
      (token.isNative ||
        (typeof item.address === 'string' &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId: token.networkId,
              contractAddress: token.tokenAddress,
            },
            token2: {
              networkId: item.network,
              contractAddress: item.address,
            },
          }))),
  );
  const candidates = matchingSearchResults.flatMap((item) =>
    item.assetId ? [item.assetId] : [],
  );
  if (signal.aborted) return undefined;
  const limit = pLimit(CONCURRENCY);
  const visited = new Set<string>();
  let finished = false;
  let failed = false;
  const noMatch = new OneKeyLocalError('No matching Market asset');
  let resolveFailure: () => void = () => undefined;
  const failure = new Promise<void>((resolve) => {
    resolveFailure = resolve;
  });
  const reportFailure = () => {
    failed = true;
    resolveFailure();
  };
  let releasePriority: () => void = () => undefined;
  let priorityTimer: ReturnType<typeof setTimeout> | undefined;
  let priorityOpen = Boolean(
    candidates.length || (token.isNative && token.symbol.trim()),
  );
  const priority = priorityOpen
    ? new Promise<void>((resolve) => {
        releasePriority = resolve;
        priorityTimer = setTimeout(() => {
          priorityOpen = false;
          resolve();
        }, 2000);
      })
    : Promise.resolve();
  const loadList = (type: string) =>
    timeout(
      serviceMarket.fetchMarketAssetList({
        type,
        currency: 'usd',
        limit: 100,
        page: 1,
        autoHandleError: false,
      }),
    ).then((result) => {
      if (
        !Array.isArray(result.list) ||
        result.list.some(
          (item) => !item || typeof item.assetId !== 'string' || !item.assetId,
        )
      )
        throw new OneKeyLocalError('Invalid Market list');
      return result.list;
    });
  const matchAsset = async (assetId: string, isPreferred: boolean) => {
    if (
      finished ||
      (failed && (!isPreferred || !priorityOpen)) ||
      signal.aborted ||
      visited.has(assetId)
    )
      throw noMatch;
    visited.add(assetId);
    let detail;
    let variant;
    try {
      detail = await timeout(
        serviceMarket.fetchMarketAssetDetail({
          assetId,
          currency: 'usd',
          autoHandleError: false,
        }),
      );
      if (
        !detail?.asset ||
        detail.asset.assetId !== assetId ||
        !detail.selectedVariant ||
        !Array.isArray(detail.variants)
      )
        throw new OneKeyLocalError('Invalid Market asset detail');
      variant = resolveMarketAssetVariant({
        detail,
        networkId: token.networkId,
        tokenAddress: token.tokenAddress,
        isNative: token.isNative,
      });
    } catch (error) {
      reportFailure();
      throw error;
    }
    if (finished || signal.aborted || !variant) throw noMatch;
    if (!variant.variantId) {
      reportFailure();
      throw new OneKeyLocalError('Invalid Market asset variant');
    }
    return {
      marketTokenId: assetId,
      marketVariantId: variant.variantId,
      marketTokenCategory: MARKET_TOP_COINS_CATEGORY_ID,
      tokenAddress: variant.tokenAddress,
      network: variant.networkId,
      isNative: variant.isNative,
    };
  };
  const scan = async (list: Promise<IMarketAssetListItem[]>) => {
    let items: IMarketAssetListItem[];
    try {
      items = await list;
    } catch (error) {
      reportFailure();
      throw error;
    }
    const scanItems = (assets: IMarketAssetListItem[], isPreferred = false) => {
      let index = 0;
      const worker = async () => {
        while (index < assets.length) {
          if (
            finished ||
            (failed && (!isPreferred || !priorityOpen)) ||
            signal.aborted
          )
            break;
          const { assetId } = assets[index];
          index += 1;
          try {
            return await limit(() => matchAsset(assetId, isPreferred));
          } catch {
            /* Try another asset. */
          }
        }
        throw noMatch;
      };
      return Promise.any(
        Array.from({ length: Math.min(CONCURRENCY, assets.length) }, worker),
      );
    };
    const isPriority = (item: IMarketAssetListItem) =>
      candidates.includes(item.assetId) ||
      (token.isNative &&
        typeof item.symbol === 'string' &&
        item.symbol.trim().toUpperCase() === token.symbol.trim().toUpperCase());
    const preferred = items.filter(isPriority);
    const remaining = items.filter((item) => !isPriority(item));
    return Promise.any([
      scanItems(preferred, true),
      remaining.length
        ? priority.then(() => scanItems(remaining))
        : scanItems([]),
    ]);
  };
  const top = scan(loadList(MARKET_TOP_COINS_CATEGORY_ID));
  const others = (async () => {
    let config;
    try {
      config = await timeout(
        serviceMarketV2.fetchMarketBasicConfig({ autoHandleError: false }),
      );
      if (
        config.code !== 0 ||
        !config.data ||
        (config.data.assetCategories !== undefined &&
          (!Array.isArray(config.data.assetCategories) ||
            config.data.assetCategories.some(
              (item) => !item || typeof item.category !== 'string',
            )))
      )
        throw new OneKeyLocalError('Market config unavailable');
    } catch (error) {
      reportFailure();
      throw error;
    }
    if (signal.aborted || finished) throw noMatch;
    const types = [
      ...new Set(
        (config.data.assetCategories ?? []).map(({ category }) =>
          getMarketTopCoinsRequestType(category),
        ),
      ),
    ].filter((type) => type !== MARKET_TOP_COINS_CATEGORY_ID);
    return Promise.any(types.map((type) => scan(loadList(type))));
  })();
  try {
    return await timeout(
      Promise.race([
        Promise.any([top, others]).catch(() => undefined),
        // Give priority candidates a bounded chance to match before fallback.
        failure.then(() => priority).then(() => undefined),
      ]),
    );
  } catch {
    return undefined;
  } finally {
    finished = true;
    clearTimeout(priorityTimer);
    releasePriority();
  }
}
