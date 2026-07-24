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

export type IPortfolioClaimProtocolIdentity = {
  symbol: string;
  vault?: string;
};

export type IPortfolioClaimSourceCandidate = IPortfolioClaimProtocolIdentity & {
  networkId: string;
  providerName: string;
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

export function resolveUniquePortfolioClaimSourceIdentity({
  networkId,
  providerName,
  candidates,
}: {
  networkId: string;
  providerName: string;
  candidates: IPortfolioClaimSourceCandidate[];
}): IPortfolioClaimProtocolIdentity | null {
  const identities = new Map<string, IPortfolioClaimProtocolIdentity>();

  candidates.forEach((candidate) => {
    if (
      candidate.networkId !== networkId ||
      candidate.providerName !== providerName ||
      !candidate.symbol.trim()
    ) {
      return;
    }

    const normalizedVault = networkUtils.isEvmNetwork({
      networkId: candidate.networkId,
    })
      ? candidate.vault?.toLowerCase()
      : candidate.vault;
    const identityKey = `${candidate.symbol}_${getPortfolioProtocolIdentityKey({
      networkId: candidate.networkId,
      provider: candidate.providerName,
      vault: normalizedVault,
    })}`;
    identities.set(identityKey, {
      symbol: candidate.symbol,
      vault: normalizedVault,
    });
  });

  return identities.size === 1 ? Array.from(identities.values())[0] : null;
}

export function resolvePortfolioClaimProtocolIdentity({
  isAirdrop,
  providerName,
  assetSymbol,
  assetVault,
  claimSymbol,
  claimSymbolStatus,
  sourceIdentity,
}: {
  isAirdrop: boolean;
  providerName: string;
  assetSymbol: string;
  assetVault?: string;
  claimSymbol?: string;
  claimSymbolStatus?: IEarnPortfolioClaimSymbolStatus;
  sourceIdentity?: IPortfolioClaimProtocolIdentity | null;
}): IPortfolioClaimProtocolIdentity | null {
  if (!isAirdrop) {
    return {
      symbol: assetSymbol,
      vault: assetVault,
    };
  }

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

  if (claimSymbolStatus === 'matched') {
    return null;
  }

  return sourceIdentity?.symbol ? sourceIdentity : null;
}
