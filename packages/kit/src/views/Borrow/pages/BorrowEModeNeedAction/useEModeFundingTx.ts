import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  filterSwapHistoryPendingList,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/InAppNotification';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { isSwapHistoryTerminalStatus } from '@onekeyhq/shared/src/utils/swapHistoryPreviewUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

export type IEModeFundingIntent = {
  stepKey: string;
  /** Lowercased funding token address; '' for the network's native token. */
  tokenAddress: string;
  armedAt: number;
  broadcasted: boolean;
  /** The top-up has been observed in pending history at least once. */
  seen: boolean;
};

/**
 * How long a broadcast top-up may stay invisible before we stop waiting for it.
 *
 * Only reached when the swap never enters pending history at all — normally the
 * bg→UI hop is sub-second. A durable-write failure in Swap history produces
 * exactly that silence, and without a deadline the shortfall card would wait on
 * a transaction no runtime can observe.
 */
export const FUNDING_INTENT_APPEARANCE_TIMEOUT_MS =
  timerUtils.getTimeDurationMs({ minute: 2 });

export type IEModeFundingState =
  /** No top-up intent armed. */
  | 'idle'
  /** Armed, but the swap is not observable yet. */
  | 'waiting'
  /** Matched in pending history and still pending. */
  | 'inFlight'
  /** The top-up stopped being in flight, whatever its outcome. */
  | 'resolved';

/**
 * Where the armed top-up currently stands.
 *
 * `resolved` deliberately covers success, failure and cancellation alike: the
 * caller only needs to know the wait is over, and re-checking the balance
 * decides what to show next. Three independent signals feed it, because no
 * single one survives every path:
 *
 * - a terminal status on the matched row — `updateSwapHistoryItem` writes the
 *   new status into the pending atom in place, without filtering terminals out;
 * - the row leaving the list — the DB-driven rebuilds keep only PENDING and
 *   CANCELING, so a terminal swap can be evicted before we ever read its status;
 * - the appearance deadline — for a swap that is never persisted, and so never
 *   appears in either.
 */
export function resolveEModeFundingState({
  intent,
  match,
  appearanceDeadlinePassed,
}: {
  intent: IEModeFundingIntent | null;
  match: ISwapTxHistory | null;
  appearanceDeadlinePassed: boolean;
}): IEModeFundingState {
  if (!intent) {
    return 'idle';
  }
  if (match) {
    return isSwapHistoryTerminalStatus(match.status) ? 'resolved' : 'inFlight';
  }
  if (intent.seen) {
    return 'resolved';
  }
  // An armed-but-never-broadcast intent is the Swap-cancelled case, which the
  // focus edge already owns. Starving it here would race that with a deadline.
  if (!intent.broadcasted) {
    return 'waiting';
  }
  return appearanceDeadlinePassed ? 'resolved' : 'waiting';
}

/**
 * Does this swap deliver the token the armed repay step is short of?
 *
 * Exported for tests: the match has to stay narrow, because a false positive
 * here yanks the user off whatever screen they are on.
 */
export function matchesFundingIntent({
  history,
  intent,
  networkId,
  accountId,
}: {
  history: ISwapTxHistory;
  intent: IEModeFundingIntent;
  networkId: string;
  accountId: string;
}): boolean {
  const toToken = history.baseInfo?.toToken;
  if (
    !toToken ||
    toToken.networkId !== networkId ||
    typeof toToken.contractAddress !== 'string'
  ) {
    return false;
  }
  if (!equalsIgnoreCase(toToken.contractAddress, intent.tokenAddress)) {
    return false;
  }
  const receiverAccountId = history.accountInfo?.receiver?.accountId;
  if (!receiverAccountId || receiverAccountId !== accountId) {
    return false;
  }
  const created = history.date?.created;
  return typeof created === 'number' && created >= intent.armedAt;
}

/** Stable per-tx key, so the consumer can act on each top-up exactly once. */
function getFundingTxKey(history: ISwapTxHistory): string {
  return (
    history.txInfo?.txId ||
    history.txInfo?.orderId ||
    history.swapInfo?.orderId ||
    `created:${history.date?.created ?? 0}`
  );
}

/**
 * Watches the global swap-pending list for the top-up swap the user explicitly
 * launched from an underfunded repay step.
 */
export function useEModeFundingTx({
  networkId,
  accountId,
  activeStepKey,
  activeFundingAddress,
}: {
  networkId: string;
  accountId: string;
  activeStepKey: string | undefined;
  activeFundingAddress: string | null;
}) {
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const [intent, setIntent] = useState<IEModeFundingIntent | null>(null);

  const armFunding = useCallback(() => {
    if (!activeStepKey || activeFundingAddress === null) {
      return;
    }
    setIntent({
      stepKey: activeStepKey,
      tokenAddress: activeFundingAddress,
      armedAt: Date.now(),
      broadcasted: false,
      seen: false,
    });
  }, [activeStepKey, activeFundingAddress]);

  const markFundingBroadcasted = useCallback(() => {
    setIntent((current) =>
      current ? { ...current, broadcasted: true } : current,
    );
  }, []);

  const disarmFunding = useCallback(() => {
    setIntent(null);
  }, []);

  // A stale intent must never hold a later step in a waiting state, so it only
  // counts while its own step is still the active one.
  const armedIntent =
    intent && intent.stepKey === activeStepKey ? intent : null;

  const match = useMemo(() => {
    if (!armedIntent) {
      return null;
    }
    return (
      filterSwapHistoryPendingList(swapHistoryPendingList).find((history) =>
        matchesFundingIntent({
          history,
          intent: armedIntent,
          networkId,
          accountId,
        }),
      ) ?? null
    );
  }, [armedIntent, swapHistoryPendingList, networkId, accountId]);

  const matchKey = match ? getFundingTxKey(match) : null;

  // Sticky, and scoped to the intent that saw it: once the swap has appeared,
  // its later absence is an outcome rather than the pre-arrival silence.
  useEffect(() => {
    if (!matchKey) {
      return;
    }
    setIntent((current) =>
      current && current.stepKey === activeStepKey && !current.seen
        ? { ...current, seen: true }
        : current,
    );
  }, [matchKey, activeStepKey]);

  const [appearanceDeadlinePassed, setAppearanceDeadlinePassed] =
    useState(false);
  useEffect(() => {
    if (!armedIntent || !armedIntent.broadcasted || armedIntent.seen) {
      setAppearanceDeadlinePassed(false);
      return;
    }
    const timer = setTimeout(
      () => setAppearanceDeadlinePassed(true),
      Math.max(
        0,
        armedIntent.armedAt + FUNDING_INTENT_APPEARANCE_TIMEOUT_MS - Date.now(),
      ),
    );
    return () => clearTimeout(timer);
  }, [armedIntent]);

  const fundingState = resolveEModeFundingState({
    intent: armedIntent,
    match,
    appearanceDeadlinePassed,
  });

  const fundingTxKey = fundingState === 'inFlight' ? matchKey : null;
  const fundingBroadcasted = armedIntent?.broadcasted ?? false;

  return {
    /**
     * Key of the in-flight top-up swap, or null. Changes exactly once per
     * transaction, so an effect can treat it as the submit edge.
     */
    fundingTxKey,
    /** The broadcast callback closes the bridge gap before history arrives. */
    fundingBroadcasted,
    /** A top-up swap has broadcast or is represented in Swap history. */
    funding: fundingBroadcasted || fundingTxKey !== null,
    /**
     * The wait is over. Stays true until the consumer disarms, so the submitted
     * state holds while the refreshed balance decides what to show next.
     */
    fundingResolved: fundingState === 'resolved',
    armFunding,
    markFundingBroadcasted,
    disarmFunding,
  };
}

export function shouldDisarmFundingIntentOnFocus({
  isFocused,
  previousIsFocused,
  fundingTxKey,
  fundingBroadcasted,
}: {
  isFocused: boolean;
  previousIsFocused: boolean | undefined;
  fundingTxKey: string | null;
  fundingBroadcasted: boolean;
}) {
  return (
    isFocused &&
    previousIsFocused === false &&
    !fundingTxKey &&
    !fundingBroadcasted
  );
}
