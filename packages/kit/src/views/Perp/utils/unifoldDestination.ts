// cspell: words hypercore unifold Unifold
import type { IUnifoldSupportedAsset } from '@onekeyhq/shared/types/unifoldDeposit';

// The supported-assets endpoint is queried with our hardcoded HyperCore
// destination; the wallet service rejects destinations outside its allowlist
// (10422), so a usable response doubles as the destination validity check.
// This guard only has VETO power: an empty or degenerate catalog disables the
// Unifold entry, it can never rewrite the hardcoded destination. Empty or
// undefined data fails closed.
export function hasUsableUnifoldSupportedAssets(
  assets: IUnifoldSupportedAsset[] | undefined,
): boolean {
  if (!assets?.length) {
    return false;
  }
  return assets.some((asset) => (asset.chains ?? []).length > 0);
}
