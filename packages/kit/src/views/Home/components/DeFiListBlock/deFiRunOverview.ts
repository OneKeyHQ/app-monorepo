import BigNumber from 'bignumber.js';

export interface IDeFiRunOverview {
  totalValue: number;
  totalDebt: number;
  totalReward: number;
  netWorth: number;
  chains: string[];
  protocolCount: number;
  positionCount: number;
}

export function getEmptyDeFiRunOverview(): IDeFiRunOverview {
  return {
    totalValue: 0,
    totalDebt: 0,
    totalReward: 0,
    netWorth: 0,
    chains: [],
    protocolCount: 0,
    positionCount: 0,
  };
}

/**
 * Sum of every response a cold All Networks fan-out has merged so far.
 *
 * Written to the overview atom as a whole rather than added to it: the base
 * the atom held before the run — the overview this owner kept from before an
 * enabled-network change, for example, still counting the disabled network —
 * is not part of the total.
 */
export function accumulateDeFiRunOverview(
  soFar: IDeFiRunOverview,
  flushed: IDeFiRunOverview,
): IDeFiRunOverview {
  return {
    totalValue: new BigNumber(soFar.totalValue)
      .plus(flushed.totalValue)
      .toNumber(),
    totalDebt: new BigNumber(soFar.totalDebt)
      .plus(flushed.totalDebt)
      .toNumber(),
    totalReward: new BigNumber(soFar.totalReward)
      .plus(flushed.totalReward)
      .toNumber(),
    netWorth: new BigNumber(soFar.netWorth).plus(flushed.netWorth).toNumber(),
    chains: Array.from(new Set([...soFar.chains, ...flushed.chains])),
    protocolCount: soFar.protocolCount + flushed.protocolCount,
    positionCount: soFar.positionCount + flushed.positionCount,
  };
}

/**
 * Whether a throttled flush may replace the overview atom with the run's sum.
 *
 * The first flush is the leading edge of the throttle, often a single
 * network's empty response while the rest are still in flight. Replacing the
 * header's DeFi total with that 0 drops it until the next flush — and lets
 * the header confirm a token-only balance meanwhile — so nothing is written
 * until the sum holds a position or worth. A run whose every network really
 * is empty lands its 0 through the published result once the fan-out ends.
 *
 * Worth counts on its own: a network can report value whose protocols were
 * all filtered out of the list as low value.
 */
export function shouldPublishDeFiRunOverview(
  overview: IDeFiRunOverview,
): boolean {
  return (
    overview.positionCount > 0 ||
    overview.protocolCount > 0 ||
    !new BigNumber(overview.totalValue).isZero() ||
    !new BigNumber(overview.totalDebt).isZero() ||
    !new BigNumber(overview.totalReward).isZero() ||
    !new BigNumber(overview.netWorth).isZero()
  );
}
