import BigNumber from 'bignumber.js';

import type { IEarnPortfolioInvestment } from '@onekeyhq/shared/types/staking';

export type IEarnPortfolioInvestmentSource = 'normal' | 'airdrop';

export interface IEarnPortfolioInvestmentFetchResult {
  key: string;
  source: IEarnPortfolioInvestmentSource;
  investment?: IEarnPortfolioInvestment;
  remove?: boolean;
}

const addValue = (left: string | undefined, right: string | undefined) =>
  new BigNumber(left || '0').plus(new BigNumber(right || '0')).toFixed();

export const hasEarnPortfolioAirdropAssets = (
  investment: IEarnPortfolioInvestment | undefined,
) =>
  Boolean(
    investment?.airdropAssets.some(
      (asset) => (asset.airdropAssets?.length ?? 0) > 0,
    ),
  );

export const mergeEarnPortfolioInvestments = (
  existing: IEarnPortfolioInvestment,
  incoming: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => ({
  ...existing,
  assets: [...existing.assets, ...incoming.assets],
  airdropAssets: [...existing.airdropAssets, ...incoming.airdropAssets],
  totalFiatValue: addValue(existing.totalFiatValue, incoming.totalFiatValue),
  totalFiatValueUsd: addValue(
    existing.totalFiatValueUsd,
    incoming.totalFiatValueUsd,
  ),
});

const clearNormalInvestment = (
  investment: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => {
  const { netPnl, netPnlFiatValue, ...rest } = investment;
  return {
    ...rest,
    assets: [],
    totalFiatValue: '0',
    totalFiatValueUsd: '0',
    earnings24hFiatValue: '0',
  };
};

const clearAirdropInvestment = (
  investment: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => ({
  ...investment,
  airdropAssets: [],
});

const hasEarnPortfolioNormalAssets = (
  investment: IEarnPortfolioInvestment | undefined,
) => Boolean(investment?.assets.length);

export const removeEarnPortfolioInvestmentSource = ({
  requestMap,
  key,
  source,
}: {
  requestMap: Map<string, IEarnPortfolioInvestment>;
  key: string;
  source: IEarnPortfolioInvestmentSource;
}) => {
  const existing = requestMap.get(key);
  if (!existing) {
    return;
  }

  const nextInvestment =
    source === 'normal'
      ? clearNormalInvestment(existing)
      : clearAirdropInvestment(existing);

  if (
    hasEarnPortfolioNormalAssets(nextInvestment) ||
    hasEarnPortfolioAirdropAssets(nextInvestment)
  ) {
    requestMap.set(key, nextInvestment);
    return;
  }

  requestMap.delete(key);
};

const mergeNormalInvestment = ({
  existing,
  incoming,
  hasUpdatedNormal,
  preserveExistingAirdrop,
}: {
  existing: IEarnPortfolioInvestment | undefined;
  incoming: IEarnPortfolioInvestment;
  hasUpdatedNormal: boolean;
  preserveExistingAirdrop: boolean;
}) => {
  if (!existing) {
    return incoming;
  }

  if (hasUpdatedNormal) {
    return mergeEarnPortfolioInvestments(existing, incoming);
  }

  if (!preserveExistingAirdrop) {
    return incoming;
  }

  return {
    ...incoming,
    airdropAssets: existing.airdropAssets,
  };
};

const mergeAirdropInvestment = ({
  existing,
  incoming,
  hasUpdatedAirdrop,
}: {
  existing: IEarnPortfolioInvestment | undefined;
  incoming: IEarnPortfolioInvestment;
  hasUpdatedAirdrop: boolean;
}) => {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    airdropAssets: [
      ...(hasUpdatedAirdrop ? existing.airdropAssets : []),
      ...incoming.airdropAssets,
    ],
  };
};

export const applyEarnPortfolioFetchResult = ({
  requestMap,
  result,
  normalKeysUpdatedInSession,
  airdropKeysUpdatedInSession,
  preserveExistingAirdropOnNormalUpdate = false,
  preserveAirdropOnNormalRemove = false,
}: {
  requestMap: Map<string, IEarnPortfolioInvestment>;
  result: IEarnPortfolioInvestmentFetchResult;
  normalKeysUpdatedInSession: Set<string>;
  airdropKeysUpdatedInSession: Set<string>;
  preserveExistingAirdropOnNormalUpdate?: boolean;
  preserveAirdropOnNormalRemove?: boolean;
}) => {
  const sourceUpdatedKeys =
    result.source === 'normal'
      ? normalKeysUpdatedInSession
      : airdropKeysUpdatedInSession;
  const hasUpdatedSource = sourceUpdatedKeys.has(result.key);
  const existing = requestMap.get(result.key);

  if (result.remove) {
    sourceUpdatedKeys.add(result.key);

    if (
      result.source === 'normal' &&
      preserveAirdropOnNormalRemove &&
      existing &&
      hasEarnPortfolioAirdropAssets(existing)
    ) {
      requestMap.set(result.key, clearNormalInvestment(existing));
    } else {
      requestMap.delete(result.key);
    }

    return true;
  }

  if (!result.investment) {
    return false;
  }

  sourceUpdatedKeys.add(result.key);
  requestMap.set(
    result.key,
    result.source === 'normal'
      ? mergeNormalInvestment({
          existing,
          incoming: result.investment,
          hasUpdatedNormal: hasUpdatedSource,
          preserveExistingAirdrop: preserveExistingAirdropOnNormalUpdate,
        })
      : mergeAirdropInvestment({
          existing,
          incoming: result.investment,
          hasUpdatedAirdrop: hasUpdatedSource,
        }),
  );

  return true;
};
