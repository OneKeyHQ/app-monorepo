// cspell:ignore randMult
type IXmrDestination = {
  'to_address': string;
  'send_amount': string;
};

/** A Monero send. The fee depends on input selection, so the transaction is built at review time. */
export type IEncodedTxXmr = {
  from: string;
  to: string;
  /** Piconero. Authoritative. */
  amountAtomic: string;
  /** XMR, for display only. Derived from `amountAtomic`, never the reverse. */
  amount: string;
  priority: IXmrFeePriority;
  /** Send everything: the runtime solves `spendable - fee` and writes it back into `amountAtomic`. */
  isMaxSend?: boolean;

  /**
   * The constructed unsigned transaction; signing takes only this. It contains the private view key
   * (change output), so it may only cross a trust boundary the view key may cross.
   */
  signableHex?: string;
  /**
   * A hardware account's signing plan (JSON), in place of `signableHex`. It holds the real ring
   * members, masks and amounts: same handling as `signableHex`, never into history or logs.
   */
  devicePlanJson?: string;
  /** Piconero. Exact once `signableHex` or `devicePlanJson` is set. */
  feeAtomic?: string;
  inputCount?: number;
  /** Piconero returned to this account's own primary address. */
  changeAtomic?: string;
  /** The tip the decoys were chosen against. */
  chainTip?: number;
  /** Local scan request that supplied the reviewed inputs. */
  privacyEpoch?: string;
};

/**
 * A send's tx private keys, kept for payment proofs as wallet2 keeps them. Never part of the
 * transaction: the XMR vault moves them into its sent record when signing.
 */
export type IXmrSentTxKeys =
  | {
      /** Hex scalar r, the discrete log of the transaction's public key. */
      txKey: string;
      /** One per output when the transaction has additional public keys; usually empty. */
      additionalTxKeys: string[];
    }
  | {
      /** A hardware send's keys, sealed by the device; it opens them with these again. */
      device: {
        salt: string;
        randMult: string;
        txEncKeys: string;
        txPrefixHash: string;
      };
    };

/** Fee tiers as monerod names them; strings, since a number cannot be validated on arrival. */
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
