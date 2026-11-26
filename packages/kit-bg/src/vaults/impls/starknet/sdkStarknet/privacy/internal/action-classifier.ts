import type { HistoryTransaction, HistoryNote } from "./history";

export type SwapLeg = {
  token: bigint;
  amount: bigint;
};

export type HistoryAction =
  | { type: "deposit"; fromAddress: bigint; token: bigint; amount: bigint }
  | { type: "withdrawal"; toAddress: bigint; token: bigint; amount: bigint }
  | { type: "fee"; toAddress: bigint; token: bigint; amount: bigint }
  | { type: "transferSent"; toAddress: bigint; token: bigint; amount: bigint; noteCount: number }
  | {
      type: "transferReceived";
      fromAddress: bigint;
      token: bigint;
      amount: bigint;
      noteCount: number;
    }
  | { type: "swap"; executor: bigint; sent: SwapLeg[]; received: SwapLeg[] }
  | { type: "transferSelf"; token: bigint; amount: bigint; noteCount: number }
  | { type: "register"; pubkey: bigint };

export type HistoryActionKind = HistoryAction["type"];

export type ClassifiedTransaction = {
  blockNumber: number;
  transactionHash: bigint;
  actions: HistoryAction[];
};

export type ClassifyOptions = {
  /** Addresses that receive fee payments (e.g. paymaster forwarder).
   *  Withdrawals to these addresses won't prevent transferSelf detection. */
  feeRecipients?: bigint[];
};

/** Classifies a history transaction's raw events into user-facing actions. Pure, no I/O. */
export function classifyTransaction(
  transaction: HistoryTransaction,
  options?: ClassifyOptions
): ClassifiedTransaction {
  if (transaction.registeredPubkey != null) {
    return {
      blockNumber: transaction.blockNumber,
      transactionHash: transaction.transactionHash,
      actions: [{ type: "register", pubkey: transaction.registeredPubkey }],
    };
  }

  const actions: HistoryAction[] = [];

  // Step 1: Detect swaps — openNoteDeposits are swap received legs, grouped by depositor (executor).
  // Withdrawals matching an executor's address become the swap's sent legs.
  const swapsByExecutor = new Map<bigint, { sent: SwapLeg[]; received: SwapLeg[] }>();
  const matchedWithdrawalIndexes = new Set<number>();

  for (const openNoteDeposit of transaction.openNoteDeposits) {
    let swap = swapsByExecutor.get(openNoteDeposit.depositor);
    if (!swap) {
      swap = { sent: [], received: [] };
      swapsByExecutor.set(openNoteDeposit.depositor, swap);
    }
    swap.received.push({ token: openNoteDeposit.token, amount: openNoteDeposit.amount });
  }

  for (const [executor, swap] of swapsByExecutor) {
    for (let index = 0; index < transaction.withdrawals.length; index++) {
      if (matchedWithdrawalIndexes.has(index)) continue;
      if (transaction.withdrawals[index].toAddress === executor) {
        const withdrawal = transaction.withdrawals[index];
        swap.sent.push({ token: withdrawal.token, amount: withdrawal.amount });
        matchedWithdrawalIndexes.add(index);
      }
    }
    actions.push({ type: "swap", executor, sent: swap.sent, received: swap.received });
  }

  // Step 2: Classify deposits and remaining withdrawals.
  // Withdrawals to fee recipients (e.g. paymaster forwarder) are classified as "fee".
  const feeRecipientSet = new Set(options?.feeRecipients);

  for (const deposit of transaction.deposits) {
    actions.push({ type: "deposit", ...deposit });
  }

  for (let index = 0; index < transaction.withdrawals.length; index++) {
    if (matchedWithdrawalIndexes.has(index)) continue;
    const withdrawal = transaction.withdrawals[index];
    const type = feeRecipientSet.has(withdrawal.toAddress)
      ? ("fee" as const)
      : ("withdrawal" as const);
    actions.push({ type, ...withdrawal });
  }

  // Step 3: Classify notes — aggregate by (channelKind, counterparty, token)
  const noteAggregates = new Map<
    string,
    { note: HistoryNote; totalAmount: bigint; noteCount: number }
  >();
  const selfChannelAggregates = new Map<bigint, { totalAmount: bigint; noteCount: number }>();

  for (const note of transaction.notes) {
    if (note.channelKind === "self_channel") {
      const existing = selfChannelAggregates.get(note.token);
      if (existing) {
        existing.totalAmount += note.amount;
        existing.noteCount += 1;
      } else {
        selfChannelAggregates.set(note.token, { totalAmount: note.amount, noteCount: 1 });
      }
      continue;
    }
    const aggregateKey = `${note.channelKind}:${note.counterparty}:${note.token}`;
    const existing = noteAggregates.get(aggregateKey);
    if (existing) {
      existing.totalAmount += note.amount;
      existing.noteCount += 1;
    } else {
      noteAggregates.set(aggregateKey, { note, totalAmount: note.amount, noteCount: 1 });
    }
  }

  for (const { note, totalAmount, noteCount } of noteAggregates.values()) {
    if (note.channelKind === "outgoing") {
      actions.push({
        type: "transferSent",
        toAddress: note.counterparty,
        token: note.token,
        amount: totalAmount,
        noteCount,
      });
    } else {
      actions.push({
        type: "transferReceived",
        fromAddress: note.counterparty,
        token: note.token,
        amount: totalAmount,
        noteCount,
      });
    }
  }

  // Step 4: Detect sweep/spray — only self_channel notes, no other meaningful events.
  // Fee actions don't count as meaningful for this check.
  const meaningfulActions = actions.filter((a) => a.type !== "fee");
  if (meaningfulActions.length === 0 && selfChannelAggregates.size > 0) {
    for (const [token, { totalAmount, noteCount }] of selfChannelAggregates) {
      actions.push({ type: "transferSelf", token, amount: totalAmount, noteCount });
    }
  }

  // Step 5: Strip fee actions from incoming transfers — the sender paid the fee, not the receiver.
  const isIncoming =
    actions.some((a) => a.type === "transferReceived") &&
    !actions.some((a) => a.type === "transferSent");
  const filteredActions = isIncoming ? actions.filter((a) => a.type !== "fee") : actions;

  return {
    blockNumber: transaction.blockNumber,
    transactionHash: transaction.transactionHash,
    actions: filteredActions,
  };
}
