// cspell: words hypercore unifold Unifold
import type {
  IUnifoldDepositWallet,
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
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

type IUnifoldChainIdentity = Pick<
  IUnifoldSupportedAssetChain,
  'chain_type' | 'chain_id'
>;

// Unifold identifies a chain by (chain_type, chain_id). chain_id alone is not
// unique: every non-EVM chain uses 'mainnet' (solana, bitcoin, tron), so a
// chain_id-only match treats Tron and Solana as the same network.
export function isSameUnifoldChain(
  a: IUnifoldChainIdentity | null | undefined,
  b: IUnifoldChainIdentity | null | undefined,
): boolean {
  if (!a || !b) {
    return false;
  }
  return a.chain_type === b.chain_type && a.chain_id === b.chain_id;
}

// Mirrors the SDK chain-snap rule: picking a token keeps the current chain
// when the token offers it, and otherwise snaps to the token's first chain.
export function pickUnifoldChainForAsset(
  asset: IUnifoldSupportedAsset,
  currentChain: IUnifoldChainIdentity | null | undefined,
): IUnifoldSupportedAssetChain | undefined {
  return (
    asset.chains.find((chain) => isSameUnifoldChain(chain, currentChain)) ??
    asset.chains[0]
  );
}

export function findMatchingUnifoldSourceSelection(
  assets: IUnifoldSupportedAsset[] | undefined,
  selection: {
    asset: Pick<IUnifoldSupportedAsset, 'symbol'>;
    chain: Pick<
      IUnifoldSupportedAssetChain,
      'chain_id' | 'chain_type' | 'token_address'
    >;
  } | null,
): {
  asset: IUnifoldSupportedAsset;
  chain: IUnifoldSupportedAssetChain;
} | null {
  if (!assets || !selection) {
    return null;
  }
  const asset = assets.find((item) => item.symbol === selection.asset.symbol);
  const chain = asset?.chains.find(
    (item) =>
      item.chain_id === selection.chain.chain_id &&
      item.chain_type === selection.chain.chain_type &&
      item.token_address === selection.chain.token_address,
  );
  return asset && chain ? { asset, chain } : null;
}
