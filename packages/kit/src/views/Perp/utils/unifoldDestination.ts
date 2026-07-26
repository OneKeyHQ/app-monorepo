// cspell: words hypercore unifold Unifold
import type {
  IUnifoldDepositWallet,
  IUnifoldSupportedAsset,
} from '@onekeyhq/shared/types/unifoldDeposit';

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

export function filterUnifoldSupportedAssetsByWallets(
  assets: IUnifoldSupportedAsset[] | undefined,
  wallets: IUnifoldDepositWallet[] | null | undefined,
): IUnifoldSupportedAsset[] | undefined {
  if (!assets) {
    return undefined;
  }
  const usableChainTypes = new Set(
    (wallets ?? [])
      .filter((wallet) => Boolean(wallet.address))
      .map((wallet) => wallet.chainType.toLowerCase()),
  );
  return assets
    .map((asset) => ({
      ...asset,
      chains: (asset.chains ?? []).filter((chain) =>
        usableChainTypes.has(chain.chain_type.toLowerCase()),
      ),
    }))
    .filter((asset) => asset.chains.length > 0);
}
