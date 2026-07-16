import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapSelectedTokensColdStartContextAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  type ESwapStockTradeSide,
  getTokenIdentityKey,
} from './swapStockChannelUtils';
import { swapStockDisplaySnapshotStorage } from './swapStockDisplaySnapshotStorage';
import {
  type ISwapStockDisplayIdentity,
  type ISwapStockDisplaySnapshot,
  type ISwapStockDisplaySnapshotPatch,
  buildSwapStockDisplayIdentityKey,
  getMatchingSwapStockDisplaySnapshot,
  mergeSwapStockDisplaySnapshot,
  projectSwapStockDisplayTokenDetail,
  resolveSwapStockDisplayAccountKey,
} from './swapStockDisplaySnapshotUtils';

export function useSwapStockDisplaySnapshot({
  currentStockToken,
  liveTokenDetail,
  payToken,
  tradeSide,
}: {
  currentStockToken?: ISwapToken;
  liveTokenDetail?: IMarketTokenDetail;
  payToken?: ISwapToken;
  tradeSide: ESwapStockTradeSide;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [coldStartContext] = useSwapSelectedTokensColdStartContextAtom();
  const [initialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const [settings] = useSettingsPersistAtom();
  const activeAccountCandidateKey = useMemo(
    () => buildSwapSelectedTokensColdStartAccountKey(activeAccount),
    [activeAccount],
  );
  const coldStartAccountKey =
    !initialSelectedTokensSynced &&
    coldStartContext?.swapType === ESwapTabSwitchType.STOCK
      ? coldStartContext.accountKey
      : undefined;
  // During real cold start the validated cold-start context can paint before
  // the account store is ready. During an account switch, however, a visible
  // candidate owner must match that context or the snapshot is rejected.
  const accountKey = resolveSwapStockDisplayAccountKey({
    activeAccountCandidateKey,
    activeAccountReady: activeAccount.ready,
    coldStartAccountKey,
    initialSelectedTokensSynced,
  });
  const stockTokenKey = getTokenIdentityKey(currentStockToken);
  const payTokenKey = getTokenIdentityKey(payToken);
  const currency = settings.currencyInfo.id;
  const identity = useMemo<ISwapStockDisplayIdentity | undefined>(() => {
    if (!accountKey || !stockTokenKey || !payTokenKey || !currency) {
      return undefined;
    }
    return {
      accountKey,
      stockTokenKey,
      payTokenKey,
      tradeSide,
      currency,
    };
  }, [accountKey, currency, payTokenKey, stockTokenKey, tradeSide]);
  const identityKey = buildSwapStockDisplayIdentityKey(identity);
  const storedSnapshot = useMemo(
    () =>
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: accountKey
          ? swapStockDisplaySnapshotStorage.get(accountKey)
          : undefined,
      }),
    [accountKey, identity],
  );
  const [snapshotState, setSnapshotState] = useState<{
    identityKey: string;
    snapshot?: ISwapStockDisplaySnapshot;
  }>({
    identityKey,
    snapshot: storedSnapshot,
  });
  const snapshotRef = useRef<ISwapStockDisplaySnapshot | undefined>(
    snapshotState.snapshot,
  );
  const identityRef = useRef(identity);
  const identityKeyRef = useRef(identityKey);
  const accountKeyRef = useRef(accountKey);

  // Derive the current render from the new identity immediately. The effect
  // only reconciles local state; it is never needed to hide an old owner.
  const currentSnapshot =
    snapshotState.identityKey === identityKey
      ? snapshotState.snapshot
      : storedSnapshot;
  snapshotRef.current = currentSnapshot;
  identityRef.current = identity;
  identityKeyRef.current = identityKey;
  accountKeyRef.current = accountKey;
  useEffect(() => {
    if (snapshotState.identityKey === identityKey) {
      return;
    }
    snapshotRef.current = storedSnapshot;
    setSnapshotState({ identityKey, snapshot: storedSnapshot });
  }, [identityKey, snapshotState.identityKey, storedSnapshot]);

  const commitSnapshotPatch = useCallback(
    ({
      expectedIdentityKey,
      patch,
    }: {
      expectedIdentityKey: string;
      patch: ISwapStockDisplaySnapshotPatch;
    }) => {
      const currentIdentity = identityRef.current;
      const currentIdentityKey = identityKeyRef.current;
      const currentAccountKey = accountKeyRef.current;
      if (
        !currentIdentity ||
        !currentAccountKey ||
        !expectedIdentityKey ||
        expectedIdentityKey !== currentIdentityKey
      ) {
        return false;
      }
      const stored = getMatchingSwapStockDisplaySnapshot({
        identity: currentIdentity,
        snapshot: swapStockDisplaySnapshotStorage.get(currentAccountKey),
      });
      const nextSnapshot = mergeSwapStockDisplaySnapshot({
        identity: currentIdentity,
        previous: snapshotRef.current ?? stored,
        patch,
      });
      snapshotRef.current = nextSnapshot;
      setSnapshotState({
        identityKey: currentIdentityKey,
        snapshot: nextSnapshot,
      });
      swapStockDisplaySnapshotStorage.set(currentAccountKey, nextSnapshot);
      return true;
    },
    [],
  );

  const projectedLiveTokenDetail = useMemo(
    () =>
      identity && liveTokenDetail?.stock
        ? projectSwapStockDisplayTokenDetail(liveTokenDetail)
        : undefined,
    [identity, liveTokenDetail],
  );
  const tokenDetailCheckpointIdentityRef = useRef('');
  useEffect(() => {
    if (!projectedLiveTokenDetail || !identityKey) {
      return;
    }
    if (tokenDetailCheckpointIdentityRef.current === identityKey) {
      return;
    }
    if (
      commitSnapshotPatch({
        expectedIdentityKey: identityKey,
        patch: { tokenDetail: projectedLiveTokenDetail },
      })
    ) {
      // WebSocket price ticks remain render-only. Persist one stable checkpoint
      // per identity/mount; balance and chart completions create later coarse
      // checkpoints without serializing the store on every market tick.
      tokenDetailCheckpointIdentityRef.current = identityKey;
    }
  }, [commitSnapshotPatch, identityKey, projectedLiveTokenDetail]);

  return {
    accountKey,
    identity,
    identityKey,
    snapshot: currentSnapshot,
    displayTokenDetail:
      projectedLiveTokenDetail ?? currentSnapshot?.tokenDetail?.data,
    commitSnapshotPatch,
  };
}

export type IUseSwapStockDisplaySnapshotReturn = ReturnType<
  typeof useSwapStockDisplaySnapshot
>;
