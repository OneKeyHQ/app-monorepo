import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import type {
  IHistoryAmount,
  IHistoryTransferDirection,
} from '../HomeHistoryListView/historyActivityRows';

export type IWalletActivityHintAmount = Pick<
  IHistoryAmount,
  'key' | 'text' | 'tone'
>;

// Completed activity stays news for a day unless the user has seen it.
export const WALLET_ACTIVITY_HINT_WINDOW_MS = 24 * 60 * 60 * 1000;
// "Seen" marks are kept per account and network; old scopes fall off.
export const WALLET_ACTIVITY_SEEN_SCOPE_LIMIT = 50;

export type IWalletActivityHintStatus = 'pending' | 'failed' | 'done';

export type IWalletActivityHintSelection = {
  lead: IAccountHistoryTx;
  status: IWalletActivityHintStatus;
};

export type IWalletActivitySeenMap = Record<string, number>;

export function getWalletActivityTxTime(tx: IAccountHistoryTx): number {
  const time = tx.decodedTx.updatedAt ?? tx.decodedTx.createdAt ?? 0;
  // Guard against a row stamped in seconds; history rows use milliseconds.
  return time > 0 && time < 1e12 ? time * 1000 : time;
}

export function getWalletActivityHintStatus(
  tx: IAccountHistoryTx,
): IWalletActivityHintStatus | undefined {
  switch (getHistoryTxDisplayStatus(tx)) {
    case EDecodedTxStatus.Pending:
      return 'pending';
    case EDecodedTxStatus.Failed:
    case EDecodedTxStatus.Dropped:
      return 'failed';
    case EDecodedTxStatus.Confirmed:
      return 'done';
    default:
      // Removed / offline rows never surface on the home page.
      return undefined;
  }
}

/**
 * Pending activity leads until it settles; otherwise the newest activity of
 * the last day that the user has not seen yet. `seenAt` is when the user last
 * looked (opened History or pressed the line) for this account and network.
 */
export function selectWalletActivityHint({
  txs,
  seenAt,
  now,
}: {
  txs: IAccountHistoryTx[];
  seenAt: number | undefined;
  now: number;
}): IWalletActivityHintSelection | undefined {
  const byNewest = (a: IAccountHistoryTx, b: IAccountHistoryTx) =>
    getWalletActivityTxTime(b) - getWalletActivityTxTime(a);
  const pending = txs
    .filter((tx) => getWalletActivityHintStatus(tx) === 'pending')
    .toSorted(byNewest);
  const unseen = txs
    .filter((tx) => {
      const status = getWalletActivityHintStatus(tx);
      if (!status || status === 'pending') return false;
      const time = getWalletActivityTxTime(tx);
      return (
        now - time <= WALLET_ACTIVITY_HINT_WINDOW_MS && time > (seenAt ?? 0)
      );
    })
    .toSorted(byNewest);
  const lead = pending[0] ?? unseen[0];
  const status = lead ? getWalletActivityHintStatus(lead) : undefined;
  if (!lead || !status) return undefined;
  return { lead, status };
}

export function getWalletActivitySeenScopeKey({
  ownerId,
  networkId,
}: {
  ownerId: string;
  networkId: string;
}) {
  return `${ownerId}|${networkId}`;
}

export function updateWalletActivitySeenMap({
  seenMap,
  scopeKey,
  seenAt,
}: {
  seenMap: IWalletActivitySeenMap | undefined;
  scopeKey: string;
  seenAt: number;
}): IWalletActivitySeenMap {
  return Object.fromEntries(
    Object.entries({ ...seenMap, [scopeKey]: seenAt })
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, WALLET_ACTIVITY_SEEN_SCOPE_LIMIT),
  );
}

/**
 * A glance answers "did it arrive / did it go": the signed amount alone for a
 * send or receive (its value is in the total and in History), "from → to" for
 * a swap. Approvals and contract calls read fine with the title alone.
 */
export function getWalletActivityHintAmounts({
  direction,
  primary,
  secondary,
}: {
  direction: IHistoryTransferDirection | undefined;
  primary: IWalletActivityHintAmount | undefined;
  secondary: IWalletActivityHintAmount | undefined;
}): IWalletActivityHintAmount[] {
  const hasText = (amount: IWalletActivityHintAmount | undefined) =>
    !!amount?.text && amount.text !== '-';
  if (direction === 'send' || direction === 'receive') {
    return primary && hasText(primary) ? [primary] : [];
  }
  if (direction === 'both' && primary && secondary) {
    if (!hasText(primary) || !hasText(secondary)) return [];
    // The arrow carries the direction, so the signs go.
    const unsigned = (text: string) => text.replace(/^[+\-−]\s?/, '');
    return [
      { key: 'from', text: unsigned(secondary.text), tone: 'secondary' },
      { key: 'to', text: unsigned(primary.text), tone: 'positive' },
    ];
  }
  return [];
}

// What the line says. `key` names the transaction and its state: a new key is
// a different event (it cross-fades in), the same key is that event updating
// in place (the time moving on, amounts hidden).
export type IWalletActivityHint = {
  key: string;
  status: IWalletActivityHintStatus;
  // Left out when the amounts already say it: a sign for send and receive,
  // an arrow for a swap.
  title?: string;
  amounts: IWalletActivityHintAmount[];
  when: string;
};

export function isSameWalletActivityHint(
  a: IWalletActivityHint | undefined,
  b: IWalletActivityHint | undefined,
) {
  if (a === b) return true;
  if (!a || !b) return false;
  const amountsText = (hint: IWalletActivityHint) =>
    hint.amounts
      .map((amount) => `${amount.key}:${amount.tone ?? ''}:${amount.text}`)
      .join('|');
  return (
    a.key === b.key &&
    a.status === b.status &&
    a.title === b.title &&
    a.when === b.when &&
    amountsText(a) === amountsText(b)
  );
}

// The line folds open, rests, folds away, or is gone.
export type IWalletActivityHintPhase =
  | 'hidden'
  | 'entering'
  | 'shown'
  | 'exiting';

export type IWalletActivityHintTransition = {
  // The latest input, to tell what changed.
  hint: IWalletActivityHint | undefined;
  instantKey: string | undefined;
  // What the line draws: the latest hint, or the last one while folding away.
  drawn: IWalletActivityHint | undefined;
  // The previous event, fading out on top of the new one.
  leaving: IWalletActivityHint | undefined;
  phase: IWalletActivityHintPhase;
};

export function initWalletActivityHintTransition({
  hint,
  instantKey,
}: {
  hint: IWalletActivityHint | undefined;
  instantKey: string | undefined;
}): IWalletActivityHintTransition {
  return {
    hint,
    instantKey,
    drawn: hint,
    leaving: undefined,
    phase: hint ? 'shown' : 'hidden',
  };
}

/**
 * A new `instantKey` lands the change that comes with it without motion: it
 * arrives with a bigger change on screen (another account, the first answer,
 * History opening). Otherwise the line folds in and out, and a new event
 * cross-fades over the previous one.
 */
export function updateWalletActivityHintTransition(
  state: IWalletActivityHintTransition,
  input: {
    hint: IWalletActivityHint | undefined;
    instantKey: string | undefined;
  },
): IWalletActivityHintTransition {
  const { hint, instantKey } = input;
  if (instantKey !== state.instantKey) {
    return initWalletActivityHintTransition(input);
  }
  if (isSameWalletActivityHint(hint, state.hint)) return state;
  if (!hint) {
    return { ...state, hint, leaving: undefined, phase: 'exiting' };
  }
  if (state.phase === 'hidden' || state.phase === 'exiting') {
    return {
      ...state,
      hint,
      drawn: hint,
      leaving: undefined,
      phase: 'entering',
    };
  }
  return {
    ...state,
    hint,
    drawn: hint,
    leaving: hint.key === state.drawn?.key ? state.leaving : state.drawn,
  };
}

// The fold finished: an opening line is at rest, a closing one is gone.
export function settleWalletActivityHintTransition(
  state: IWalletActivityHintTransition,
): IWalletActivityHintTransition {
  if (state.phase === 'entering') return { ...state, phase: 'shown' };
  if (state.phase === 'exiting') {
    return { ...state, drawn: undefined, phase: 'hidden' };
  }
  return state;
}
