import {
  DEX_ASSET_ID_OFFSETS,
  DEX_SEPARATOR,
  HIP3_ASSET_ID_STRIDE,
  SPOT_ASSET_ID_OFFSET,
  SUB_DEX_LIST,
} from '../../types/hyperliquid/perp.constants';

// Local dexIndex: 0 = main perps DEX, 1..n = SUB_DEX_LIST order.
export function getDexAssetIdOffset(dexIndex: number): number {
  return DEX_ASSET_ID_OFFSETS[dexIndex] ?? 0;
}

export function getDexIndexByCoin(coin: string): number {
  if (!coin) return 0;
  const separatorIndex = coin.indexOf(DEX_SEPARATOR);
  if (separatorIndex <= 0) return 0;
  const prefix = coin.slice(0, separatorIndex);
  const subDexIndex = SUB_DEX_LIST.findIndex((item) => item.prefix === prefix);
  return subDexIndex < 0 ? 0 : subDexIndex + 1;
}

// Returns -1 for spot assetIds and for HIP-3 namespaces we do not register, so
// callers never index a perp ctx array with an id that is not ours. Each dex
// owns exactly HIP3_ASSET_ID_STRIDE ids, and hyperliquid dex indexes are
// non-contiguous (xyz=1 ... para=8), so the ranges must be bounded on both sides.
export function getDexIndexByAssetId(assetId: number): number {
  for (
    let dexIndex = DEX_ASSET_ID_OFFSETS.length - 1;
    dexIndex >= 1;
    dexIndex -= 1
  ) {
    const offset = DEX_ASSET_ID_OFFSETS[dexIndex];
    if (assetId >= offset && assetId < offset + HIP3_ASSET_ID_STRIDE) {
      return dexIndex;
    }
  }
  return assetId >= SPOT_ASSET_ID_OFFSET ? -1 : 0;
}

export function toCtxIndex(assetId: number, dexIndex?: number): number {
  const targetDexIndex =
    typeof dexIndex === 'number' ? dexIndex : getDexIndexByAssetId(assetId);
  if (targetDexIndex < 0) return -1;
  return assetId - getDexAssetIdOffset(targetDexIndex);
}

export function toAssetId({
  dexIndex,
  index,
}: {
  dexIndex: number;
  index: number;
}): number {
  return getDexAssetIdOffset(dexIndex) + index;
}

// A persisted `tradingUniverses` cache is positional, so one written before a
// new sub-DEX was registered is shorter than the registry. It still looks
// populated, which would otherwise let callers serve a dex set that silently
// omits the new dex — treat that as a cache miss and force a refresh.
export function isPerpsUniverseCacheComplete(
  universesByDex: unknown[][] | undefined,
): boolean {
  if (!universesByDex || universesByDex.length < SUB_DEX_LIST.length + 1) {
    return false;
  }
  // Every registered slot must carry data. Gating on slot 0 alone would accept
  // `[main, xyz, []]` — the shape produced when one `allPerpMetas()` response
  // omits a dex and there is no previous slot to preserve — and consumers would
  // then serve a universe missing that dex with nothing triggering a retry.
  return universesByDex
    .slice(0, SUB_DEX_LIST.length + 1)
    .every((items) => (items?.length ?? 0) > 0);
}

// Universal search returns the bare symbol plus the dex it belongs to, where
// `perps` means the main DEX and anything else is the sub-DEX prefix itself
// (e.g. `xyz`, `para`). Returns undefined for a dex we do not support, so
// callers can skip the result instead of pointing it at the wrong market.
export function buildCoinFromSearchAssetType({
  assetType,
  name,
}: {
  assetType: string | undefined;
  name: string;
}): string | undefined {
  if (!name) return undefined;
  if (assetType === 'perps') return name;
  const prefix = assetType?.toLowerCase();
  if (!prefix) return undefined;
  const isRegistered = SUB_DEX_LIST.some((item) => item.prefix === prefix);
  return isRegistered ? `${prefix}${DEX_SEPARATOR}${name}` : undefined;
}

// TV lowercases everything; HL keys perps as `BTC`, spot as `@N`, and sub-DEX
// as `<prefix>:<TICKER>` with a lowercase prefix.
export function normalizeDexCoin(coin: string): string {
  if (!coin) return coin;
  if (coin.startsWith('@')) return coin;
  const separatorIndex = coin.indexOf(DEX_SEPARATOR);
  if (separatorIndex > 0) {
    const prefix = coin.slice(0, separatorIndex).toLowerCase();
    const matched = SUB_DEX_LIST.find((item) => item.prefix === prefix);
    if (matched) {
      return `${matched.prefix}${DEX_SEPARATOR}${coin
        .slice(separatorIndex + DEX_SEPARATOR.length)
        .toUpperCase()}`;
    }
  }
  return coin.toUpperCase();
}
