import BigNumber from 'bignumber.js';

import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';
import { earnTestnetNetworkIds } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type {
  IEarnAirdropInvestmentItemV2,
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

export interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}

export type IPortfolioFetchRequest = {
  accountId: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  symbol: string;
  publicKey?: string;
  vault?: string;
  ptAddress?: string;
};

export type IPortfolioPatch = {
  key: string;
  investment?: IEarnPortfolioInvestment;
  remove?: boolean;
};

export const createEarnPortfolioInvestmentKey = (item: {
  provider: string;
  symbol: string;
  vault?: string;
  networkId: string;
}) => `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

export const resolveEarnPortfolioVault = ({
  protocolVault,
  requestVault,
}: {
  protocolVault?: string;
  requestVault?: string;
}) => protocolVault || requestVault;

const hasPositiveEarnPortfolioFiatValue = (value?: string) =>
  new BigNumber(value || '0').gt(0);

const hasAnyEarnPortfolioAssets = (
  assets: Array<{
    assetsStatus?: Array<{ title: { text: string } }>;
    rewardAssets?: Array<{ title: { text: string } }>;
  }>,
) =>
  assets.length > 0 &&
  assets.some(
    (asset) =>
      (asset.assetsStatus && asset.assetsStatus.length > 0) ||
      (asset.rewardAssets && asset.rewardAssets.length > 0),
  );

const hasAnyEarnPortfolioAirdropAssets = (
  assets: Array<{
    airdropAssets?: Array<{ title: { text: string } }>;
  }>,
) =>
  assets.length > 0 &&
  assets.some((asset) => asset.airdropAssets && asset.airdropAssets.length > 0);

const isEarnPortfolioTestnetNetwork = (networkId: string) =>
  earnTestnetNetworkIds.includes(networkId);

export const sortEarnPortfolioInvestments = (
  investments: IEarnPortfolioInvestment[],
) =>
  investments.toSorted((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

export const filterValidEarnPortfolioInvestments = (
  investments: IEarnPortfolioInvestment[],
) =>
  investments.filter((investment) => {
    if (hasAnyEarnPortfolioAirdropAssets(investment.airdropAssets)) {
      return true;
    }
    if (isEarnPortfolioTestnetNetwork(investment.network.networkId)) {
      return hasAnyEarnPortfolioAssets(investment.assets);
    }
    return hasPositiveEarnPortfolioFiatValue(investment.totalFiatValue);
  });

export const createEarnPortfolioInvestmentKeyFromInvestment = (
  investment: IEarnPortfolioInvestment,
) => {
  const firstAsset = investment.assets[0] || investment.airdropAssets[0];
  const resolvedVault = resolveEarnPortfolioVault({
    protocolVault: investment.protocol.vault,
    requestVault: firstAsset?.metadata?.protocol?.vault,
  });

  return createEarnPortfolioInvestmentKey({
    provider: investment.protocol.providerDetail.code,
    symbol: investment.protocol.symbol || firstAsset?.token.info.symbol || '',
    vault: resolvedVault,
    networkId: investment.network.networkId,
  });
};

export const buildEarnPortfolioInvestmentMap = (
  investments: IEarnPortfolioInvestment[],
) =>
  new Map(
    investments.map((investment) => [
      createEarnPortfolioInvestmentKeyFromInvestment(investment),
      investment,
    ]),
  );

export const mergeEarnPortfolioInvestments = (
  existing: IEarnPortfolioInvestment,
  incoming: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => {
  const existingTotal = new BigNumber(existing.totalFiatValue || '0');
  const incomingTotal = new BigNumber(incoming.totalFiatValue || '0');
  const existingTotalUsd = new BigNumber(existing.totalFiatValueUsd || '0');
  const incomingTotalUsd = new BigNumber(incoming.totalFiatValueUsd || '0');
  const existingEarnings = new BigNumber(existing.earnings24hFiatValue || '0');
  const incomingEarnings = new BigNumber(incoming.earnings24hFiatValue || '0');

  return {
    ...existing,
    assets: [...existing.assets, ...incoming.assets],
    airdropAssets: [...existing.airdropAssets, ...incoming.airdropAssets],
    totalFiatValue: existingTotal.plus(incomingTotal).toFixed(),
    totalFiatValueUsd: existingTotalUsd.plus(incomingTotalUsd).toFixed(),
    earnings24hFiatValue: existingEarnings.plus(incomingEarnings).toFixed(),
    netPnl: incoming.netPnl || existing.netPnl,
    netPnlFiatValue: incoming.netPnlFiatValue || existing.netPnlFiatValue,
  };
};

export const applyEarnPortfolioPatch = ({
  portfolioMap,
  patch,
  shouldMergeWithExisting = true,
}: {
  portfolioMap: Map<string, IEarnPortfolioInvestment>;
  patch: IPortfolioPatch;
  shouldMergeWithExisting?: boolean;
}) => {
  if (patch.remove) {
    portfolioMap.delete(patch.key);
    return;
  }

  if (!patch.investment) {
    return;
  }

  const existingInvestment = portfolioMap.get(patch.key);
  portfolioMap.set(
    patch.key,
    shouldMergeWithExisting && existingInvestment
      ? mergeEarnPortfolioInvestments(existingInvestment, patch.investment)
      : patch.investment,
  );
};

export const materializeEarnPortfolioInvestments = (
  portfolioMap: Map<string, IEarnPortfolioInvestment>,
) =>
  sortEarnPortfolioInvestments(
    filterValidEarnPortfolioInvestments(Array.from(portfolioMap.values())),
  );

export const matchesEarnPortfolioRefreshOptions = ({
  asset,
  options,
}: {
  asset: IEarnAvailableAssetV2;
  options?: IRefreshOptions;
}) => {
  if (!options) {
    return true;
  }
  if (options.provider && asset.provider !== options.provider) {
    return false;
  }
  if (options.networkId && asset.networkId !== options.networkId) {
    return false;
  }
  if (options.symbol) {
    if (asset.type === 'airdrop') {
      if (!options.rewardSymbol || asset.symbol !== options.rewardSymbol) {
        return false;
      }
    } else if (asset.symbol !== options.symbol) {
      return false;
    }
  }

  return true;
};

export const normalizeEarnPortfolioInvestment = ({
  request,
  result,
}: {
  request: Pick<IPortfolioFetchRequest, 'symbol' | 'vault'>;
  result: IEarnInvestmentItemV2;
}): IPortfolioPatch => {
  const resolvedProtocolVault = resolveEarnPortfolioVault({
    protocolVault: result.protocol.vault,
    requestVault: request.vault,
  });
  const normalizedProtocol = resolvedProtocolVault
    ? { ...result.protocol, vault: resolvedProtocolVault }
    : result.protocol;
  const key = createEarnPortfolioInvestmentKey({
    provider: result.protocol.providerDetail.code,
    symbol: request.symbol,
    vault: resolvedProtocolVault,
    networkId: result.network.networkId,
  });
  const shouldRemove = isEarnPortfolioTestnetNetwork(result.network.networkId)
    ? !hasAnyEarnPortfolioAssets(result.assets)
    : !hasPositiveEarnPortfolioFiatValue(result.totalFiatValue);

  if (shouldRemove) {
    return { key, remove: true };
  }

  const enrichedAssets = result.assets.map((asset) => ({
    ...asset,
    metadata: {
      protocol: normalizedProtocol,
      network: result.network,
      fiatValue: result.totalFiatValue,
      fiatValueUsd: result.totalFiatValueUsd,
      netPnl: result.netPnl,
      netPnlFiatValue: result.netPnlFiatValue,
    },
  }));

  return {
    key,
    investment: {
      totalFiatValue: result.totalFiatValue,
      totalFiatValueUsd: result.totalFiatValueUsd,
      earnings24hFiatValue: result.earnings24hFiatValue,
      netPnl: result.netPnl,
      netPnlFiatValue: result.netPnlFiatValue,
      protocol: normalizedProtocol,
      network: result.network,
      assets: enrichedAssets,
      airdropAssets: [],
    },
  };
};

export const normalizeEarnPortfolioAirdropInvestment = ({
  request,
  result,
}: {
  request: Pick<IPortfolioFetchRequest, 'symbol' | 'vault'>;
  result: IEarnAirdropInvestmentItemV2;
}): IPortfolioPatch => {
  const key = createEarnPortfolioInvestmentKey({
    provider: result.protocol.providerDetail.code,
    symbol: request.symbol,
    vault: result.protocol.vault || request.vault,
    networkId: result.network.networkId,
  });

  const enrichedAirdropAssets = result.assets.map((asset) => ({
    ...asset,
    metadata: {
      protocol: result.protocol,
      network: result.network,
    },
  }));

  return {
    key,
    investment: {
      totalFiatValue: '0',
      totalFiatValueUsd: '0',
      earnings24hFiatValue: '0',
      protocol: result.protocol,
      network: result.network,
      assets: [],
      airdropAssets: enrichedAirdropAssets,
    },
  };
};

export const aggregateEarnPortfolioByProtocol = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] => {
  const protocolMap = investments.reduce((map, investment) => {
    const protocolKey = investment.protocol.providerDetail.code;
    const existing = map.get(protocolKey);

    if (existing) {
      map.set(protocolKey, mergeEarnPortfolioInvestments(existing, investment));
    } else {
      map.set(protocolKey, { ...investment });
    }

    return map;
  }, new Map<string, IEarnPortfolioInvestment>());

  return sortEarnPortfolioInvestments(Array.from(protocolMap.values()));
};

export const calculateEarnPortfolioTotalFiatValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, investment) => {
    if (investment.assets.length === 0 && investment.airdropAssets.length > 0) {
      return sum;
    }

    return sum.plus(new BigNumber(investment.totalFiatValue || '0'));
  }, new BigNumber(0));

export const calculateEarnPortfolioEarnings24hValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, investment) => {
    if (investment.assets.length === 0 && investment.airdropAssets.length > 0) {
      return sum;
    }

    return sum.plus(new BigNumber(investment.earnings24hFiatValue || '0'));
  }, new BigNumber(0));
