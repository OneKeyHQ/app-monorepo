import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapAmountInputTabSessionAtom,
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
  type ISwapStockDisplayAmountIdentity,
  type ISwapStockDisplayChartIdentity,
  type ISwapStockDisplayChartSnapshot,
  type ISwapStockDisplayIdentity,
  type ISwapStockDisplaySnapshot,
  type ISwapStockDisplaySnapshotPatch,
  SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY,
  buildSwapStockDisplayAccountIdentityKey,
  buildSwapStockDisplayAmountIdentityKey,
  buildSwapStockDisplayBalanceIdentityKey,
  buildSwapStockDisplayChartIdentityKey,
  buildSwapStockDisplayIdentityKey,
  buildSwapStockDisplayTokenDetailIdentityKey,
  getMatchingSwapStockDisplaySnapshot,
  getSwapStockDisplayAccountSnapshot,
  mergeSwapStockDisplaySnapshot,
  projectSwapStockDisplayTokenDescriptor,
  projectSwapStockDisplayTokenDetail,
  resolveSwapStockDisplayAccountKey,
} from './swapStockDisplaySnapshotUtils';
import { getSwapStockColdStartAccountKeyFromGlobalSnapshot } from './useSwapColdStartDisplayTokens';

function useSwapStockDisplayAccountOwner() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [coldStartContext] = useSwapSelectedTokensColdStartContextAtom();
  const [initialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const hasResolvedLiveAccountRef = useRef(activeAccount.ready);
  if (activeAccount.ready) {
    hasResolvedLiveAccountRef.current = true;
  }
  const activeAccountCandidateKey = useMemo(
    () => buildSwapSelectedTokensColdStartAccountKey(activeAccount),
    [activeAccount],
  );
  const mayUseColdStartOwner =
    !hasResolvedLiveAccountRef.current && !initialSelectedTokensSynced;
  const globalColdStartAccountKey = mayUseColdStartOwner
    ? getSwapStockColdStartAccountKeyFromGlobalSnapshot()
    : undefined;
  const coldStartAccountKey =
    mayUseColdStartOwner &&
    coldStartContext?.swapType === ESwapTabSwitchType.STOCK
      ? coldStartContext.accountKey
      : globalColdStartAccountKey;
  const accountKey = resolveSwapStockDisplayAccountKey({
    activeAccountCandidateKey,
    activeAccountReady: activeAccount.ready,
    coldStartAccountKey,
    initialSelectedTokensSynced,
  });

  return {
    accountKey,
    accountIdentityKey: buildSwapStockDisplayAccountIdentityKey(
      accountKey ? { accountKey } : undefined,
    ),
  };
}

export function useSwapStockDisplaySelectionBootstrap() {
  const { accountKey } = useSwapStockDisplayAccountOwner();
  const snapshot = useMemo(
    () =>
      getSwapStockDisplayAccountSnapshot({
        accountKey,
        snapshot: accountKey
          ? swapStockDisplaySnapshotStorage.get(accountKey)
          : undefined,
      }),
    [accountKey],
  );

  return {
    accountKey,
    selection: snapshot?.selection,
  };
}

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
  const { accountIdentityKey, accountKey } = useSwapStockDisplayAccountOwner();
  const [amountSessionId] = useSwapAmountInputTabSessionAtom();
  const [settings] = useSettingsPersistAtom();
  // During real cold start the validated cold-start context can paint before
  // the account store is ready. During an account switch, however, a visible
  // candidate owner must match that context or the snapshot is rejected.
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
      amountSessionId,
    };
  }, [
    accountKey,
    amountSessionId,
    currency,
    payTokenKey,
    stockTokenKey,
    tradeSide,
  ]);
  const identityKey = buildSwapStockDisplayIdentityKey(identity);
  const chartIdentity = useMemo<ISwapStockDisplayChartIdentity | undefined>(
    () =>
      accountKey && stockTokenKey
        ? {
            accountKey,
            stockTokenKey,
            sourceCurrency: SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY,
          }
        : undefined,
    [accountKey, stockTokenKey],
  );
  const chartOwnerKey = buildSwapStockDisplayChartIdentityKey(chartIdentity);
  const amountIdentity = useMemo<ISwapStockDisplayAmountIdentity | undefined>(
    () =>
      accountKey && stockTokenKey && payTokenKey
        ? {
            accountKey,
            stockTokenKey,
            payTokenKey,
            tradeSide,
            amountSessionId,
          }
        : undefined,
    [accountKey, amountSessionId, payTokenKey, stockTokenKey, tradeSide],
  );
  const amountOwnerKey = buildSwapStockDisplayAmountIdentityKey(amountIdentity);
  const tokenDetailOwnerKey = buildSwapStockDisplayTokenDetailIdentityKey(
    accountKey && stockTokenKey && currency
      ? { accountKey, stockTokenKey, currency }
      : undefined,
  );
  const inputTokenKey =
    identity?.tradeSide === 'buy'
      ? identity.payTokenKey
      : identity?.stockTokenKey;
  const balanceOwnerKey = buildSwapStockDisplayBalanceIdentityKey(
    accountKey && inputTokenKey ? { accountKey, inputTokenKey } : undefined,
  );

  // The physical cache slot changes only with account. Region selectors below
  // synchronously reject mismatched stock/pay/side owners within that slot.
  const storedAccountSnapshot = useMemo(
    () =>
      getSwapStockDisplayAccountSnapshot({
        accountKey,
        snapshot: accountKey
          ? swapStockDisplaySnapshotStorage.get(accountKey)
          : undefined,
      }),
    [accountKey],
  );
  const [snapshotState, setSnapshotState] = useState<{
    accountKey?: string;
    snapshot?: ISwapStockDisplaySnapshot;
  }>({ accountKey, snapshot: storedAccountSnapshot });
  const currentAccountSnapshot =
    snapshotState.accountKey === accountKey
      ? snapshotState.snapshot
      : storedAccountSnapshot;
  const accountSnapshotRef = useRef(currentAccountSnapshot);
  const identityRef = useRef(identity);
  const identityKeyRef = useRef(identityKey);
  const accountKeyRef = useRef(accountKey);
  const accountIdentityKeyRef = useRef(accountIdentityKey);
  const chartIdentityRef = useRef(chartIdentity);
  const chartOwnerKeyRef = useRef(chartOwnerKey);
  const amountIdentityRef = useRef(amountIdentity);
  const amountOwnerKeyRef = useRef(amountOwnerKey);
  accountSnapshotRef.current = currentAccountSnapshot;
  identityRef.current = identity;
  identityKeyRef.current = identityKey;
  accountKeyRef.current = accountKey;
  accountIdentityKeyRef.current = accountIdentityKey;
  chartIdentityRef.current = chartIdentity;
  chartOwnerKeyRef.current = chartOwnerKey;
  amountIdentityRef.current = amountIdentity;
  amountOwnerKeyRef.current = amountOwnerKey;
  useEffect(() => {
    if (snapshotState.accountKey === accountKey) {
      return;
    }
    accountSnapshotRef.current = storedAccountSnapshot;
    setSnapshotState({ accountKey, snapshot: storedAccountSnapshot });
  }, [accountKey, snapshotState.accountKey, storedAccountSnapshot]);

  const persistPatch = useCallback(
    ({
      patch,
      writeIdentity,
    }: {
      patch: ISwapStockDisplaySnapshotPatch;
      writeIdentity: Parameters<
        typeof mergeSwapStockDisplaySnapshot
      >[0]['identity'];
    }) => {
      const currentAccountKey = accountKeyRef.current;
      if (
        !currentAccountKey ||
        writeIdentity.accountKey !== currentAccountKey
      ) {
        return false;
      }
      const stored = getSwapStockDisplayAccountSnapshot({
        accountKey: currentAccountKey,
        snapshot: swapStockDisplaySnapshotStorage.get(currentAccountKey),
      });
      const nextSnapshot = mergeSwapStockDisplaySnapshot({
        identity: writeIdentity,
        previous: accountSnapshotRef.current ?? stored,
        patch,
      });
      accountSnapshotRef.current = nextSnapshot;
      setSnapshotState({
        accountKey: currentAccountKey,
        snapshot: nextSnapshot,
      });
      swapStockDisplaySnapshotStorage.set(currentAccountKey, nextSnapshot);
      return true;
    },
    [],
  );

  const commitSnapshotPatch = useCallback(
    ({
      expectedIdentityKey,
      patch,
    }: {
      expectedIdentityKey: string;
      patch: ISwapStockDisplaySnapshotPatch;
    }) => {
      const currentIdentity = identityRef.current;
      if (
        !currentIdentity ||
        !expectedIdentityKey ||
        expectedIdentityKey !== identityKeyRef.current
      ) {
        return false;
      }
      return persistPatch({ patch, writeIdentity: currentIdentity });
    },
    [persistPatch],
  );

  const commitChartSnapshot = useCallback(
    ({
      expectedOwnerKey,
      chart,
    }: {
      expectedOwnerKey: string;
      chart: Omit<ISwapStockDisplayChartSnapshot, 'identity' | 'updatedAt'>;
    }) => {
      const currentChartIdentity = chartIdentityRef.current;
      if (
        !currentChartIdentity ||
        !expectedOwnerKey ||
        expectedOwnerKey !== chartOwnerKeyRef.current
      ) {
        return false;
      }
      return persistPatch({
        patch: { chart },
        writeIdentity: currentChartIdentity,
      });
    },
    [persistPatch],
  );

  const commitSelectionSnapshot = useCallback(
    ({
      expectedOwnerKey,
      payToken: selectedPayToken,
      stockToken,
      tradeSide: selectedTradeSide,
    }: {
      expectedOwnerKey: string;
      payToken?: ISwapToken;
      stockToken: ISwapToken;
      tradeSide: ESwapStockTradeSide;
    }) => {
      const currentAccountKey = accountKeyRef.current;
      if (
        !currentAccountKey ||
        !expectedOwnerKey ||
        expectedOwnerKey !== accountIdentityKeyRef.current
      ) {
        return false;
      }
      return persistPatch({
        patch: {
          selection: {
            stockToken: projectSwapStockDisplayTokenDescriptor(stockToken),
            payToken: selectedPayToken
              ? projectSwapStockDisplayTokenDescriptor(selectedPayToken)
              : undefined,
            tradeSide: selectedTradeSide,
          },
        },
        writeIdentity: { accountKey: currentAccountKey },
      });
    },
    [persistPatch],
  );

  const commitAmountSnapshot = useCallback(
    ({
      expectedOwnerKey,
      value,
    }: {
      expectedOwnerKey: string;
      value: string;
    }) => {
      const currentAmountIdentity = amountIdentityRef.current;
      if (
        !currentAmountIdentity ||
        !expectedOwnerKey ||
        expectedOwnerKey !== amountOwnerKeyRef.current
      ) {
        return false;
      }
      return persistPatch({
        patch: { amount: { value } },
        writeIdentity: currentAmountIdentity,
      });
    },
    [persistPatch],
  );

  const matchingSnapshot = useMemo(
    () =>
      getMatchingSwapStockDisplaySnapshot({
        identity,
        snapshot: currentAccountSnapshot,
      }),
    [currentAccountSnapshot, identity],
  );
  const chartSnapshot =
    currentAccountSnapshot?.chart &&
    buildSwapStockDisplayChartIdentityKey(
      currentAccountSnapshot.chart.identity,
    ) === chartOwnerKey
      ? currentAccountSnapshot.chart
      : undefined;
  const tokenDetailSnapshot =
    currentAccountSnapshot?.tokenDetail &&
    buildSwapStockDisplayTokenDetailIdentityKey(
      currentAccountSnapshot.tokenDetail.identity,
    ) === tokenDetailOwnerKey
      ? currentAccountSnapshot.tokenDetail
      : undefined;
  const selectionSnapshot = currentAccountSnapshot?.selection;
  const selectedStockTokenKey = getTokenIdentityKey(
    selectionSnapshot?.stockToken,
  );
  const selectedPayTokenKey = getTokenIdentityKey(selectionSnapshot?.payToken);
  const selectionAmountIdentity =
    accountKey &&
    selectionSnapshot?.tradeSide &&
    selectedStockTokenKey &&
    selectedPayTokenKey &&
    (!stockTokenKey || stockTokenKey === selectedStockTokenKey) &&
    (!payTokenKey || payTokenKey === selectedPayTokenKey)
      ? {
          accountKey,
          stockTokenKey: selectedStockTokenKey,
          payTokenKey: selectedPayTokenKey,
          tradeSide: selectionSnapshot.tradeSide,
          amountSessionId,
        }
      : undefined;
  // Before live pay-token selection lands, an account-owned selection can
  // recover the exact display amount owner. It is never used as execution
  // readiness; the live amount identity above remains the only write gate.
  const displayAmountIdentity = amountIdentity ?? selectionAmountIdentity;
  const displayAmountOwnerKey = buildSwapStockDisplayAmountIdentityKey(
    displayAmountIdentity,
  );
  const amountSnapshot =
    currentAccountSnapshot?.amount &&
    buildSwapStockDisplayAmountIdentityKey(
      currentAccountSnapshot.amount.identity,
    ) === displayAmountOwnerKey
      ? currentAccountSnapshot.amount
      : undefined;

  const projectedLiveTokenDetail = useMemo(
    () =>
      tokenDetailOwnerKey && liveTokenDetail?.stock
        ? projectSwapStockDisplayTokenDetail(liveTokenDetail)
        : undefined,
    [liveTokenDetail, tokenDetailOwnerKey],
  );
  const tokenDetailCheckpointIdentityRef = useRef('');
  useEffect(() => {
    if (!projectedLiveTokenDetail || !identityKey || !tokenDetailOwnerKey) {
      return;
    }
    if (tokenDetailCheckpointIdentityRef.current === tokenDetailOwnerKey) {
      return;
    }
    if (
      commitSnapshotPatch({
        expectedIdentityKey: identityKey,
        patch: { tokenDetail: projectedLiveTokenDetail },
      })
    ) {
      // WebSocket price ticks remain render-only. Persist one stable checkpoint
      // per token-detail owner/mount, independent from pay token and side.
      tokenDetailCheckpointIdentityRef.current = tokenDetailOwnerKey;
    }
  }, [
    commitSnapshotPatch,
    identityKey,
    projectedLiveTokenDetail,
    tokenDetailOwnerKey,
  ]);

  const currentSelectionKey = `${selectedStockTokenKey}|${selectedPayTokenKey}|${
    selectionSnapshot?.tradeSide ?? ''
  }`;
  const nextSelectionKey = `${stockTokenKey}|${payTokenKey}|${tradeSide}`;
  useEffect(() => {
    if (
      !currentStockToken ||
      !payToken ||
      !accountIdentityKey ||
      !stockTokenKey ||
      currentSelectionKey === nextSelectionKey
    ) {
      return;
    }
    commitSelectionSnapshot({
      expectedOwnerKey: accountIdentityKey,
      payToken,
      stockToken: currentStockToken,
      tradeSide,
    });
  }, [
    accountIdentityKey,
    commitSelectionSnapshot,
    currentSelectionKey,
    currentStockToken,
    nextSelectionKey,
    payToken,
    stockTokenKey,
    tradeSide,
  ]);

  return {
    accountKey,
    identity,
    identityKey,
    snapshot: matchingSnapshot,
    displayTokenDetail: projectedLiveTokenDetail ?? tokenDetailSnapshot?.data,
    commitSnapshotPatch,
    tokenDetail: {
      ownerKey: tokenDetailOwnerKey,
      snapshot: tokenDetailSnapshot,
    },
    balance: {
      ownerKey: balanceOwnerKey,
      snapshot: matchingSnapshot?.balance,
    },
    chart: {
      identity: chartIdentity,
      ownerKey: chartOwnerKey,
      snapshot: chartSnapshot,
      commitSnapshot: commitChartSnapshot,
    },
    selection: {
      ownerKey: accountIdentityKey,
      snapshot: selectionSnapshot,
      restoredToken: selectionSnapshot?.stockToken,
      commitSnapshot: commitSelectionSnapshot,
    },
    amount: {
      identity: displayAmountIdentity,
      ownerKey: displayAmountOwnerKey,
      snapshot: amountSnapshot,
      restoredValue: amountSnapshot?.value,
      commitSnapshot: commitAmountSnapshot,
    },
  };
}
