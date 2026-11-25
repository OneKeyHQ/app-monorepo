import type { BlockIdentifier } from "starknet";
import type { StarknetAddressBigint } from "../interfaces";
import { toHex } from "../utils/convert";
import type { NotesCursor, ChannelCursor } from "./channel";

// SDK public types

export type ChannelKind = "incoming" | "outgoing" | "self_channel";

export type HistorySubchannel = {
  channelKey: bigint;
  token: bigint;
  channelKind: ChannelKind;
  counterparty: bigint;
  nextIndex: number | undefined;
};

export type HistoryCursor = {
  subchannels: HistorySubchannel[];
  beginBlockNumber?: number;
  historyComplete: boolean;
};

export type HistoryNote = {
  channelKind: ChannelKind;
  token: bigint;
  noteIndex: number;
  noteId: bigint;
  counterparty: bigint;
  amount: bigint;
  salt: bigint;
};

export type HistoryDeposit = {
  fromAddress: bigint;
  token: bigint;
  amount: bigint;
};

export type HistoryWithdrawal = {
  toAddress: bigint;
  token: bigint;
  amount: bigint;
};

export type HistoryOpenNoteDeposit = {
  depositor: bigint;
  token: bigint;
  noteId: bigint;
  amount: bigint;
};

export type HistoryTransaction = {
  blockNumber: number;
  transactionHash: bigint;
  notes: HistoryNote[];
  deposits: HistoryDeposit[];
  withdrawals: HistoryWithdrawal[];
  openNoteDeposits: HistoryOpenNoteDeposit[];
  /** Present only on the synthetic registration transaction (last in history). */
  registeredPubkey?: bigint;
};

export type HistoryPage = {
  blockRef: BlockIdentifier;
  transactions: HistoryTransaction[];
  cursor: HistoryCursor;
};

// API wire types (private)

type ApiHistorySubchannel = {
  channel_key: string;
  token: string;
  channel_kind: string;
  counterparty: string;
  next_index: number | null;
};

type ApiHistoryCursor = {
  subchannels: ApiHistorySubchannel[];
  begin_block_number?: number;
  history_complete: boolean;
};

type ApiHistoryNote = {
  channel_kind: string;
  token: string;
  note_index: number;
  note_id: string;
  counterparty: string;
  amount: string;
  salt: string;
};

type ApiHistoryDeposit = {
  user_address: string;
  token: string;
  amount: string;
};

type ApiHistoryWithdrawal = {
  to_address: string;
  token: string;
  amount: string;
};

type ApiHistoryOpenNoteDeposit = {
  depositor: string;
  token: string;
  note_id: string;
  amount: string;
};

type ApiHistoryTransaction = {
  block_number: number;
  transaction_hash: string;
  notes: ApiHistoryNote[];
  deposits: ApiHistoryDeposit[];
  withdrawals: ApiHistoryWithdrawal[];
  open_note_deposits: ApiHistoryOpenNoteDeposit[];
  registered_pubkey?: string;
};

export type ApiHistoryResponse = {
  block_ref: BlockIdentifier;
  transactions: ApiHistoryTransaction[];
  cursor: ApiHistoryCursor;
};

// Conversion helpers

/** Builds a HistoryCursor from sync cursors (notes + channels). */
export function buildHistoryCursor(
  userAddress: StarknetAddressBigint,
  notesCursor: NotesCursor,
  channelCursor: ChannelCursor
): HistoryCursor {
  const subchannels: HistorySubchannel[] = [];

  // Incoming subchannels from notesCursor
  for (const [sender, incomingChannel] of notesCursor.incomingChannels) {
    for (const [token, noteIndex] of incomingChannel.noteIndexes) {
      subchannels.push({
        channelKey: incomingChannel.channelKey,
        token,
        channelKind: sender === userAddress ? "self_channel" : "incoming",
        counterparty: sender,
        nextIndex: noteIndex > 0 ? noteIndex - 1 : undefined,
      });
    }
  }

  // Outgoing subchannels from channelCursor
  if (channelCursor.channels) {
    for (const [recipient, channel] of channelCursor.channels) {
      if (!channel.key) continue;
      if (recipient === userAddress) continue;
      const channelKind: ChannelKind = "outgoing";
      for (const [token, tokenChannel] of channel.tokens) {
        subchannels.push({
          channelKey: channel.key,
          token,
          channelKind,
          counterparty: recipient,
          nextIndex: tokenChannel.noteNonce > 0 ? tokenChannel.noteNonce - 1 : undefined,
        });
      }
    }
  }

  return { subchannels, historyComplete: false };
}

/** Converts SDK HistoryCursor → API wire format. */
export function historyCursorToApi(cursor: HistoryCursor): ApiHistoryCursor {
  return {
    subchannels: cursor.subchannels.map((sc) => ({
      channel_key: toHex(sc.channelKey),
      token: toHex(sc.token),
      channel_kind: sc.channelKind,
      counterparty: toHex(sc.counterparty),
      next_index: sc.nextIndex ?? null,
    })),
    begin_block_number: cursor.beginBlockNumber,
    history_complete: cursor.historyComplete,
  };
}

/** Converts API history response → SDK HistoryPage. */
export function apiResponseToHistoryPage(resp: ApiHistoryResponse): HistoryPage {
  return {
    blockRef: resp.block_ref,
    transactions: resp.transactions.map((tx) => ({
      blockNumber: tx.block_number,
      transactionHash: BigInt(tx.transaction_hash),
      notes: tx.notes.map((note) => ({
        channelKind: note.channel_kind as ChannelKind,
        token: BigInt(note.token),
        noteIndex: note.note_index,
        noteId: BigInt(note.note_id),
        counterparty: BigInt(note.counterparty),
        amount: BigInt(note.amount),
        salt: BigInt(note.salt),
      })),
      deposits: tx.deposits.map((deposit) => ({
        fromAddress: BigInt(deposit.user_address),
        token: BigInt(deposit.token),
        amount: BigInt(deposit.amount),
      })),
      withdrawals: tx.withdrawals.map((withdrawal) => ({
        toAddress: BigInt(withdrawal.to_address),
        token: BigInt(withdrawal.token),
        amount: BigInt(withdrawal.amount),
      })),
      openNoteDeposits: tx.open_note_deposits.map((deposit) => ({
        depositor: BigInt(deposit.depositor),
        token: BigInt(deposit.token),
        noteId: BigInt(deposit.note_id),
        amount: BigInt(deposit.amount),
      })),
      ...(tx.registered_pubkey && { registeredPubkey: BigInt(tx.registered_pubkey) }),
    })),
    cursor: {
      subchannels: resp.cursor.subchannels.map((sc) => ({
        channelKey: BigInt(sc.channel_key),
        token: BigInt(sc.token),
        channelKind: sc.channel_kind as ChannelKind,
        counterparty: BigInt(sc.counterparty),
        nextIndex: sc.next_index ?? undefined,
      })),
      beginBlockNumber: resp.cursor.begin_block_number,
      historyComplete: resp.cursor.history_complete,
    },
  };
}
