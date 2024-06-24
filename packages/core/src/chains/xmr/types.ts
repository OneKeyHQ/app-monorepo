type IXmrDestination = {
  'to_address': string;
  'send_amount': string;
};

export type IEncodedTxXmr = {
  tx_hash?: string;
  destinations: IXmrDestination[];
  priority: number;
  address: string;
  shouldSweep: boolean;
  paymentId: string;
  nettype: number;
};

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
