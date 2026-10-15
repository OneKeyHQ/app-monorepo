/**
 * Monero vault types. Amounts cross every boundary as decimal strings of
 * piconero -- a number would silently lose precision past MAX_SAFE_INTEGER.
 */

// Runtime pool ids; history rows carry these, so they must never be renumbered.
export const XMR_POOL_IDS = {
  private: 1,
} as const;

export type IXmrPoolKey = 'private';

/** One scanned output as the vault hands it to the UI. */
export type IXmrOutput = {
  /** Runtime row id; used to reserve inputs for a send. */
  id: number;
  amountAtomic: string;
  globalIndex: string;
  height: number;
  /** `undefined` on the primary address. */
  subaddress?: { major: number; minor: number };
  /** False when the runtime has no key image yet, so it cannot tell whether this output is already spent. */
  spendKnown: boolean;
};

/**
 * `unverifiableAtomic` must be surfaced, not folded into the total: it is
 * value the wallet cannot confirm is still unspent, for lack of key images.
 */
export type IXmrBalance = {
  totalAtomic: string;
  unlockedAtomic: string;
  lockedByReservationAtomic: string;
  unverifiableAtomic: string;
};

export type IXmrSyncProgress = {
  blocksScanned: number;
  outputsFound: number;
  spendsDetected: number;
  fromHeight: number | null;
  toHeight: number | null;
  scannedToHeight: number | null;
  remainingBlocks: number;
  done: boolean;
  outputsWithoutKeyImage: number;
};

export type IXmrHistoryItem = {
  txid: string;
  height: number | null;
  direction: 'in' | 'out';
  receivedAtomic: string;
  spentAtomic: string;
  timestamp: number | null;
  /** Our send never reached the node's pool; its inputs are spendable again. */
  failed?: boolean;
  /** Amount plus fee, recorded when this device broadcast it. */
  outgoingAtomic?: string | null;
};

// The wire shape lives with the chain, beside the runtime that produces it.
export type {
  IEncodedTxXmr,
  IXmrFeePriority,
} from '@onekeyhq/core/src/chains/xmr/types';
