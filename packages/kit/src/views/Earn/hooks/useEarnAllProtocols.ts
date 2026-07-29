import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { parseFormattedLiquidityValue } from '../utils/availableAssetsUtils';

export type IEarnProtocolTokenRow = {
  symbol: string;
  item: IStakeProtocolListItem;
  tvlValue: number;
};

export type IEarnAggregatedProvider = {
  /** provider 标识 (server 下发的 name，小写归一) */
  provider: string;
  /** 展示名 (取首个协议行的 provider.name) */
  providerName: string;
  logoURI: string;
  /** 全部 vault/token 的 TVL 合计 (USD 数值，仅用于排序与展示) */
  tvlValue: number;
  tokens: IEarnProtocolTokenRow[];
};

const FETCH_CONCURRENCY = 10;
// 聚合结果缓存 5 分钟，对齐服务端 available-assets / 协议数据的缓存节奏。
// 没有这层缓存时，Protocols 页与协议 Tokens 页每次 mount 都会把全部
// symbol 的 getProtocolList 重拉一遍（背景层 memoize 仅 5s），导致每次
// 进页都要 5s+ 的骨架屏。
const AGGREGATED_CACHE_MAX_AGE = 5 * 60 * 1000;

function getItemTvlValue(item: IStakeProtocolListItem): number {
  return parseFormattedLiquidityValue(
    item.provider.totalFiatValue || item.provider.tvl || item.tvl?.text,
  );
}

/**
 * Worker-pool 并发拉取（无分块屏障）：旧实现按 5 个一组 allSettled，
 * 每组都要等组内最慢请求返回才开始下一组（木桶效应），30 个 symbol
 * 串行 6 组轻松 3-5s。改为固定 worker 数量从队列取任务，快请求完成后
 * 立即补位，总耗时 ≈ 总量/并发 × 平均耗时。
 */
async function fetchListsBySymbol(
  symbols: string[],
): Promise<Map<string, IStakeProtocolListItem[]>> {
  const listsBySymbol = new Map<string, IStakeProtocolListItem[]>();
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(FETCH_CONCURRENCY, symbols.length) },
    async () => {
      while (cursor < symbols.length) {
        const symbol = symbols[cursor];
        cursor += 1;
        try {
          listsBySymbol.set(
            symbol,
            await backgroundApiProxy.serviceStaking.getProtocolList({
              symbol,
            }),
          );
        } catch {
          // 单个 symbol 失败跳过，不阻塞整页
        }
      }
    },
  );
  await Promise.all(workers);
  return listsBySymbol;
}

/** 把 (symbol, 协议行) 归并进 providerMap，聚合 TVL 与 token 行 */
function mergeItemIntoProviderMap(
  providerMap: Map<string, IEarnAggregatedProvider>,
  symbol: string,
  item: IStakeProtocolListItem,
) {
  const providerKey = item.provider.name?.toLowerCase();
  if (!providerKey) {
    return;
  }
  const tvlValue = getItemTvlValue(item);
  const existing = providerMap.get(providerKey);
  if (existing) {
    existing.tvlValue += tvlValue;
    existing.tokens.push({ symbol, item, tvlValue });
  } else {
    providerMap.set(providerKey, {
      provider: providerKey,
      providerName: item.provider.name,
      logoURI: item.provider.logoURI,
      tvlValue,
      tokens: [{ symbol, item, tvlValue }],
    });
  }
}

/**
 * 兜底路径 (老服务端灰度期)：`earn/v2/available-assets` 给出全量支持的
 * (token, protocol) 映射，按去重后的 symbol 逐个拉 `getProtocolList`，
 * 客户端归并。~30 个请求，冷加载 1s+。
 */
async function fetchAggregatedByFanOut(): Promise<IEarnAggregatedProvider[]> {
  const v2Assets = await backgroundApiProxy.serviceStaking.getAvailableAssetsV2();
  const symbols = Array.from(
    new Set(
      v2Assets
        .filter((asset) => asset.type === 'normal')
        .map((asset) => asset.symbol),
    ),
  );

  const listsBySymbol = await fetchListsBySymbol(symbols);

  const providerMap = new Map<string, IEarnAggregatedProvider>();
  for (const [symbol, items] of listsBySymbol.entries()) {
    for (const item of items) {
      mergeItemIntoProviderMap(providerMap, symbol, item);
    }
  }
  return Array.from(providerMap.values());
}

/**
 * 全协议聚合 (OK-58505 Protocols 首页)：
 * 优先走单请求全量接口 —— `stake-protocol/list` 不传 symbol 时服务端
 * 返回所有协议行（6.6.0+ 服务端支持，每行带 `symbol` 字段），客户端只做
 * provider 归并。若服务端尚未支持（灰度期报错/返回空/行缺 symbol），
 * 回落到按 symbol 扇出的旧路径。
 */
async function fetchAllProtocolsAggregated(): Promise<
  IEarnAggregatedProvider[]
> {
  try {
    const items = await backgroundApiProxy.serviceStaking.getAllProtocolList();
    if (items.length > 0 && items.every((item) => item.symbol)) {
      const providerMap = new Map<string, IEarnAggregatedProvider>();
      for (const item of items) {
        mergeItemIntoProviderMap(providerMap, item.symbol ?? '', item);
      }
      return Array.from(providerMap.values());
    }
  } catch {
    // 老服务端不支持不传 symbol (校验 422)，走兜底
  }
  return fetchAggregatedByFanOut();
}

let aggregatedCachePromise:
  | Promise<IEarnAggregatedProvider[]>
  | undefined;
let aggregatedCacheTime = 0;

function getAllProtocolsAggregated({
  forceRefresh,
}: { forceRefresh?: boolean } = {}): Promise<IEarnAggregatedProvider[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    aggregatedCachePromise &&
    now - aggregatedCacheTime < AGGREGATED_CACHE_MAX_AGE
  ) {
    return aggregatedCachePromise;
  }
  aggregatedCacheTime = now;
  aggregatedCachePromise = fetchAllProtocolsAggregated().catch((error) => {
    // 失败不缓存，下次进页重试
    aggregatedCachePromise = undefined;
    throw error;
  });
  return aggregatedCachePromise;
}

export function useEarnAllProtocols() {
  const { result, isLoading, run } = usePromiseResult(
    () => getAllProtocolsAggregated(),
    [],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );

  const refresh = useCallback(async () => {
    await getAllProtocolsAggregated({ forceRefresh: true });
    return run();
  }, [run]);

  return {
    providers: result ?? [],
    isLoading: isLoading === true && !result,
    refresh,
  };
}
