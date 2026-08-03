import { useCallback, useMemo, useState } from 'react';

import {
  filterSwapHistoryPendingList,
  useInAppNotificationAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/InAppNotification';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

export type IEModeFundingIntent = {
  stepKey: string;
  /** Lowercased funding token address; '' for the network's native token. */
  tokenAddress: string;
  armedAt: number;
  broadcasted: boolean;
};

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

  const fundingTxKey = useMemo(() => {
    if (!armedIntent) {
      return null;
    }
    const match = filterSwapHistoryPendingList(swapHistoryPendingList).find(
      (history) =>
        matchesFundingIntent({
          history,
          intent: armedIntent,
          networkId,
          accountId,
        }),
    );
    return match ? getFundingTxKey(match) : null;
  }, [armedIntent, swapHistoryPendingList, networkId, accountId]);

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
