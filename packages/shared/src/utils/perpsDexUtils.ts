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
