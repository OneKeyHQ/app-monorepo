import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';
import type { IEarnPortfolioClaimSymbolStatus } from '@onekeyhq/shared/types/staking';

export type IPortfolioClaimSymbolMatch =
  | {
      status: 'matched';
      symbol: string;
    }
  | {
      status: 'ambiguous';
    };

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
  const claimSymbolMap = new Map<string, IPortfolioClaimSymbolMatch>();

  assets.forEach((asset) => {
    if (asset.type !== 'normal') {
      return;
    }

    const key = getPortfolioProtocolIdentityKey(asset);
    const existingMatch = claimSymbolMap.get(key);
    if (existingMatch?.status === 'ambiguous') {
      return;
    }
    if (existingMatch && existingMatch.symbol !== asset.symbol) {
      claimSymbolMap.set(key, { status: 'ambiguous' });
      return;
    }
    claimSymbolMap.set(key, { status: 'matched', symbol: asset.symbol });
  });

  return claimSymbolMap;
}

export function resolvePortfolioClaimProtocolIdentity({
  providerName,
  assetSymbol,
  assetVault,
  claimSymbol,
  claimSymbolStatus,
  stakedSymbol,
  stakedVault,
}: {
  providerName: string;
  assetSymbol: string;
  assetVault?: string;
  claimSymbol?: string;
  claimSymbolStatus?: IEarnPortfolioClaimSymbolStatus;
  stakedSymbol?: string;
  stakedVault?: string;
}) {
  if (earnUtils.isPendleProvider({ providerName })) {
    return {
      symbol: assetSymbol,
      vault: assetVault,
    };
  }

  if (claimSymbolStatus === 'ambiguous') {
    return null;
  }

  if (claimSymbol) {
    return {
      symbol: claimSymbol,
      vault: assetVault,
    };
  }

  return {
    symbol: stakedSymbol || assetSymbol,
    vault: stakedVault || assetVault,
  };
}
