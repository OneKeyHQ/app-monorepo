import { useEffect } from 'react';

import BigNumber from 'bignumber.js';

import {
  buildOverviewOwnerKey,
  useHomePortfolioDisplayAtom,
  useLastConfirmedOverviewBalanceAtom,
  useOverviewTokenCacheStateAtom,
} from '../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';
import { useListStructureAtom } from '../states/jotai/contexts/tokenList';

export type IHomeBalanceState = 'unknown' | 'zero' | 'positive';

export function resolveHomeBalanceState({
  hasHoldings,
  total,
  complete,
  cachedState,
}: {
  hasHoldings: boolean;
  total?: string;
  complete: boolean;
  cachedState?: Exclude<IHomeBalanceState, 'unknown'>;
}): IHomeBalanceState {
  const value = total === undefined ? undefined : new BigNumber(total);
  if (hasHoldings || (value?.isFinite() && !value.isZero())) return 'positive';
  if (complete && value?.isZero()) return 'zero';
  return cachedState ?? 'unknown';
}

// A partial zero is unknown. Only a complete, owner-matched snapshot can
// replace a previously confirmed funded state with the Add-money layout.
export function useHomeBalanceState(): IHomeBalanceState {
  const {
    activeAccount: { account, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [confirmed, setConfirmed] = useLastConfirmedOverviewBalanceAtom();
  const [display] = useHomePortfolioDisplayAtom();
  const [tokenState] = useOverviewTokenCacheStateAtom();
  const [structure] = useListStructureAtom();
  const ownerKey = buildOverviewOwnerKey(account?.id, network?.id);
  const structureMatches =
    !!ownerKey &&
    structure.generation >= 0 &&
    (structure.ownerKey === ownerKey ||
      (!!indexedAccount?.id &&
        structure.ownerKey === `${indexedAccount.id}__${network?.id}`));
  const displayMatches = !!ownerKey && display.ownerKey === ownerKey;
  const complete =
    tokenState.ownerKey === ownerKey &&
    tokenState.isComplete === true &&
    displayMatches &&
    display.isLive &&
    display.defiFiatUsd !== undefined &&
    display.perpsFiatUsd !== undefined;
  const state = resolveHomeBalanceState({
    hasHoldings: structureMatches && structure.fundedIds.length > 0,
    total: displayMatches ? display.totalFiatUsd : confirmed.byOwner[ownerKey],
    complete,
    cachedState: confirmed.assetStateByOwner?.[ownerKey],
  });
  useEffect(() => {
    if (!ownerKey || state === 'unknown') return;
    setConfirmed((prev) =>
      prev.assetStateByOwner?.[ownerKey] === state
        ? prev
        : {
            ...prev,
            assetStateByOwner: { ...prev.assetStateByOwner, [ownerKey]: state },
          },
    );
  }, [ownerKey, setConfirmed, state]);
  return state;
}
