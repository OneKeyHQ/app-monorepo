// cspell:ignore piconero monerod
/**
 * Amounts are decimal strings of piconero everywhere: Monero's supply exceeds
 * `Number.MAX_SAFE_INTEGER`, so a number would silently lose precision.
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
 * Error JSON the runtime returns across the wasm boundary. `code` is a stable
 * contract; `detail` is log-only and not translated.
 */
export type IXmrRuntimeError = {
  code: string;
  params: Record<string, unknown>;
  detail?: string | null;
};
