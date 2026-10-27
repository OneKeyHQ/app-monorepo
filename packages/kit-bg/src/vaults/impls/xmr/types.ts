/** Amounts cross every boundary as decimal piconero strings; a number loses precision past MAX_SAFE_INTEGER. */

// Runtime pool ids; history rows carry these, so they must never be renumbered.
export const XMR_POOL_IDS = {
  private: 1,
} as const;

export type IXmrPoolKey = 'private';

export type IXmrOutput = {
  id: number;
  amountAtomic: string;
  globalIndex: string;
  height: number;
  subaddress?: { major: number; minor: number };
  /** False when the runtime has no key image yet, so it cannot tell whether this output is already spent. */
  spendKnown: boolean;
};

/** `unverifiableAtomic` is value the wallet cannot confirm unspent for lack of key images; surface it, do not fold it into the total. */
export type IXmrBalance = {
  totalAtomic: string;
  unlockedAtomic: string;
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
  outgoingAtomic?: string | null;
  feeAtomic?: string | null;
  /** Paid to the account's primary address; absent from runtimes before alpha.11. */
  receivedOnPrimary?: boolean;
};

export type {
  IEncodedTxXmr,
  IXmrFeePriority,
} from '@onekeyhq/core/src/chains/xmr/types';
