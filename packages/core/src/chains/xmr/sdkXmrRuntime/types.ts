// cspell:ignore piconero monerod
/**
 * Shared types for the Monero runtime SDK.
 *
 * Amounts are decimal strings of piconero everywhere. Monero's supply is
 * 1.8e19 piconero, six orders of magnitude past `Number.MAX_SAFE_INTEGER`;
 * a number would lose precision silently, which is the worst failure mode
 * because nothing throws.
 */

export type IXmrNetwork = 'mainnet' | 'stagenet' | 'testnet';

// What the runtime re-checks the signable transaction against before signing.
export type IXmrTransactionReviewRequest = {
  network: IXmrNetwork;
  fromAddress: string;
  toAddress: string;
  amountAtomic: string;
  feeAtomic: string;
  changeAtomic: string;
  isMaxSend: boolean;
};

/** Fee tiers as monerod names them. */
export type IXmrFeePriority =
  | 'unimportant'
  | 'normal'
  | 'elevated'
  | 'priority';

/**
 * Error shape the runtime returns across the wasm boundary.
 *
 * Errors are JSON too, not `Error` objects — so the host has one parse path
 * instead of two. `code` is a stable contract; `detail` is log-only and not
 * translated.
 */
export type IXmrRuntimeError = {
  code: string;
  params: Record<string, unknown>;
  detail?: string | null;
};
