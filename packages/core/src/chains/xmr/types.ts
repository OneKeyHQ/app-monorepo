type IXmrDestination = {
  'to_address': string;
  'send_amount': string;
};

/**
 * A Monero send, as it travels from the amount screen to the broadcast.
 *
 * ## Why the fee is on here rather than quoted separately
 *
 * Monero's fee is not a rate the user picks — it is the node's published rate
 * multiplied by the transaction's weight, and the weight depends on how many
 * inputs the wallet had to gather. There is no way to know it without doing
 * the selection. So the transaction is *constructed* at review time and the
 * fee shown is read off the constructed transaction. What the confirm screen
 * displays is what the transaction will actually pay.
 *
 * The same seam is what Zcash uses with a PCZT, for the same reason.
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
   * True when the user asked to send everything.
   *
   * The amount cannot be computed on this side: it is
   * `spendable − fee`, and the fee is not known until the transaction is
   * built. The runtime solves it and writes the result back into
   * `amountAtomic`.
   */
  isMaxSend?: boolean;

  // ---- filled in by the runtime at review time (see `prepareTransaction`)

  /**
   * The constructed, unsigned transaction. Signing takes this and nothing
   * else, which is what keeps the reviewed transaction and the signed one
   * the same object.
   *
   * **This is not a harmless unsigned blob: it contains the account's private
   * view key.** Upstream writes the whole viewing pair into the change output
   * (`ChangeEnum::Standard`), because Monero's wallet protocol optimizes the
   * change output on the assumption that the sender can view it. The
   * view-key-free alternative (`Change::fingerprintable`) carries an explicit
   * upstream warning that it harms privacy, so avoiding it is not the answer.
   *
   * The consequence for any offline- or air-gapped-signing design: handing
   * this artifact to another machine hands over the ability to see every
   * payment the account has ever received. It may cross a trust boundary only
   * where the view key already may.
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
