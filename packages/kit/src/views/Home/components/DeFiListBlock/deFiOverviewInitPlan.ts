import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export interface IDeFiOverviewInitOwner {
  accountId: string;
  networkId: string;
  accountAddress?: string;
}

export interface IDeFiOverviewInitPlan {
  ownerKey: string;
  isOwnerChanged: boolean;
  /**
   * Clear `overviewDeFiDataState.isReady` before (re)initializing.
   *
   * Only an owner switch may clear it. The init effect also re-fires when
   * the currency map or display currency changes, and in All Networks mode
   * readiness is written solely by the all-network cold cache probe /
   * fan-out — nothing re-runs those for a same-owner re-fire. Clearing
   * readiness there would leave the always-visible header holding the last
   * confirmed balance indefinitely (it gates on token AND DeFi readiness).
   */
  shouldResetReadiness: boolean;
  /** Single-network owners re-hydrate the local overview on every run. */
  shouldHydrateSingleNetworkCache: boolean;
}

export function buildDeFiOverviewInitOwnerKey({
  accountId,
  networkId,
  accountAddress,
}: IDeFiOverviewInitOwner): string {
  return `${accountId}__${networkId}__${accountAddress ?? ''}`;
}

export function planDeFiOverviewInit({
  accountId,
  networkId,
  accountAddress,
  lastInitOwnerKey,
}: IDeFiOverviewInitOwner & {
  lastInitOwnerKey: string | undefined;
}): IDeFiOverviewInitPlan {
  const ownerKey = buildDeFiOverviewInitOwnerKey({
    accountId,
    networkId,
    accountAddress,
  });
  const isOwnerChanged = ownerKey !== lastInitOwnerKey;
  return {
    ownerKey,
    isOwnerChanged,
    shouldResetReadiness: isOwnerChanged,
    shouldHydrateSingleNetworkCache: !networkUtils.isAllNetwork({
      networkId,
    }),
  };
}
