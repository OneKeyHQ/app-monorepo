import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';

export function getPortfolioProtocolIdentityKey({
  networkId,
  provider,
  vault,
}: Pick<IEarnAvailableAssetV2, 'networkId' | 'provider' | 'vault'>) {
  const normalizedVault = networkUtils.isEvmNetwork({ networkId })
    ? vault?.toLowerCase()
    : vault;
  return `${networkId}_${provider}_${normalizedVault || ''}`;
}

export function buildPortfolioClaimSymbolMap(assets: IEarnAvailableAssetV2[]) {
  const claimSymbolMap = new Map<string, string>();
  const ambiguousKeys = new Set<string>();

  assets.forEach((asset) => {
    if (asset.type !== 'normal') {
      return;
    }

    const key = getPortfolioProtocolIdentityKey(asset);
    const existingSymbol = claimSymbolMap.get(key);
    if (existingSymbol && existingSymbol !== asset.symbol) {
      claimSymbolMap.delete(key);
      ambiguousKeys.add(key);
      return;
    }
    if (!ambiguousKeys.has(key)) {
      claimSymbolMap.set(key, asset.symbol);
    }
  });

  return claimSymbolMap;
}

export function resolvePortfolioClaimProtocolIdentity({
  providerName,
  assetSymbol,
  assetVault,
  claimSymbol,
  stakedSymbol,
  stakedVault,
}: {
  providerName: string;
  assetSymbol: string;
  assetVault?: string;
  claimSymbol?: string;
  stakedSymbol?: string;
  stakedVault?: string;
}) {
  if (claimSymbol) {
    return {
      symbol: claimSymbol,
      vault: assetVault,
    };
  }

  if (earnUtils.isPendleProvider({ providerName })) {
    return {
      symbol: assetSymbol,
      vault: assetVault,
    };
  }

  return {
    symbol: stakedSymbol || assetSymbol,
    vault: stakedVault || assetVault,
  };
}
