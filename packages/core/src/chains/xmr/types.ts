type IXmrDestination = {
  'to_address': string;
  'send_amount': string;
};

/**
 * A Monero send. The fee is the node's rate times the transaction's weight,
 * which depends on input selection, so the transaction is built at review
 * time and the displayed fee is read off it.
 */
export type IEncodedTxXmr = {
  from: string;
  to: string;
  /** Piconero. Authoritative. */
  amountAtomic: string;
  /** XMR, for display only. Derived from `amountAtomic`, never the reverse. */
  amount: string;
  priority: IXmrFeePriority;
  /**
   * Send everything. The amount is `spendable - fee`, solved by the runtime
   * and written back into `amountAtomic`.
   */
  isMaxSend?: boolean;

  // ---- filled in by the runtime at review time (see `prepareTransaction`)

  /**
   * The constructed, unsigned transaction; signing takes only this, so the
   * reviewed and signed transactions are the same.
   *
   * Contains the account's private view key (upstream `ChangeEnum::Standard`
   * embeds the viewing pair for the change output), so it may only cross a
   * trust boundary the view key may cross.
   */
  signableHex?: string;
  /** Piconero. Exact once `signableHex` is set. */
  feeAtomic?: string;
  inputCount?: number;
  /** Piconero returned to this account's own primary address. */
  changeAtomic?: string;
  /** The tip the decoys were chosen against. */
  chainTip?: number;
};

/**
 * Fee tiers as monerod names them. Strings, not numbers: a number crossing
 * the boundary cannot be validated on arrival.
 */
export type IXmrFeePriority =
  | 'unimportant'
  | 'normal'
  | 'elevated'
  | 'priority';

export type ISendFundsArgs = {
  destinations: IXmrDestination[];
  fromWallet_didFailToBoot: boolean;
  fromWallet_didFailToInitialize: boolean;
  fromWallet_needsImport: boolean;
  from_address_string: string;
  hasPickedAContact: boolean;
  is_sweeping: boolean;
  manuallyEnteredPaymentID: string;
  manuallyEnteredPaymentID_fieldIsVisible: boolean;
  nettype: number;
  priority: number;
  pub_spendKey_string: string;
  requireAuthentication: boolean;
  resolvedAddress: string;
  resolvedAddress_fieldIsVisible: boolean;
  resolvedPaymentID: string;
  resolvedPaymentID_fieldIsVisible: boolean;
  sec_spendKey_string: string;
  sec_viewKey_string: string;
};

export type ISendFundsCallback = {
  willBeginSending_fn: () => void;
  authenticate_fn: () => void;
  status_update_fn: () => void;
  canceled_fn: (params: { err_code: string; err_msg: string }) => void;
  success_fn: (params: {
    final_total_wo_fee: string;
    isXMRAddressIntegrated: boolean;
    mixin: number;
    serialized_signed_tx: string;
    target_address: string;
    total_sent: string;
    tx_hash: string;
    tx_key: string;
    tx_pub_key: string;
    used_fee: string;
  }) => void;

  error_fn: (params: { err_code: string; err_msg: string }) => void;

  submit_raw_tx_fn: (
    params: { tx: string },
    cb: (...args: any[]) => void,
  ) => void;

  get_random_outs_fn: (
    params: {
      amounts: string[];
      count: number;
    },
    cb: (...args: any[]) => void,
  ) => void;
  get_unspent_outs_fn: (
    params: {
      address: string;
      view_key: string;
      amount: string;
      dust_threshold: string;
      use_dust: boolean;
      mixin: number;
    },
    cb: (...args: any[]) => void,
  ) => void;
};
