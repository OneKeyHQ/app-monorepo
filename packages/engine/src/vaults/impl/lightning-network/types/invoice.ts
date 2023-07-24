import type {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../../types';

export type ICreateInvoiceParams = {
  amount: number;
  description?: string;
  description_hash?: string;
};

export type ICretaeInvoiceResponse = {
  expires_at: string;
  payment_hash: string;
  payment_request: string;
};

export type InvoiceType = {
  amount: number;
  custom_records: Record<string, number[]>;
  description: string;
  description_hash: string;
  destination: string;
  error_message: string;
  expires_at: string;
  fee: number;
  is_paid: boolean;
  keysend: boolean;
  payment_hash: string;
  payment_preimage: string;
  payment_request: string;
  settled_at: string;
  status: string;
  type: string;
};

type RoutingInfo = Array<{
  pubkey: string;
  short_channel_id: string;
  fee_base_msat: number;
  fee_proportional_millionths: number;
  cltv_expiry_delta: number;
}>;
type FallbackAddress = {
  code: number;
  address: string;
  addressHash: string;
};
type FeatureBits = {
  word_length: number;
  option_data_loss_protect?: Feature;
  initial_routing_sync?: Feature;
  option_upfront_shutdown_script?: Feature;
  gossip_queries?: Feature;
  var_onion_optin?: Feature;
  gossip_queries_ex?: Feature;
  option_static_remotekey?: Feature;
  payment_secret?: Feature;
  basic_mpp?: Feature;
  option_support_large_channel?: Feature;
  extra_bits?: {
    start_bit: number;
    bits: boolean[];
    has_required?: boolean;
  };
};
type Feature = {
  required?: boolean;
  supported?: boolean;
};
type Network = {
  [index: string]: any;
  bech32: string;
  pubKeyHash: number;
  scriptHash: number;
  validWitnessVersions: number[];
};
type UnknownTag = {
  tagCode: number;
  words: string;
};

// Start exports
export declare type TagData =
  | string
  | number
  | RoutingInfo
  | FallbackAddress
  | FeatureBits
  | UnknownTag;
export declare type TagsObject = {
  payment_hash?: string;
  payment_secret?: string;
  description?: string;
  payee_node_key?: string;
  purpose_commit_hash?: string;
  expire_time?: number;
  min_final_cltv_expiry?: number;
  fallback_address?: FallbackAddress;
  routing_info?: RoutingInfo;
  feature_bits?: FeatureBits;
  unknownTags?: UnknownTag[];
};
export declare type PaymentRequestObject = {
  paymentRequest?: string;
  complete?: boolean;
  prefix?: string;
  wordsTemp?: string;
  network?: Network;
  satoshis?: number | null;
  millisatoshis?: string | null;
  timestamp?: number;
  timestampString?: string;
  timeExpireDate?: number;
  timeExpireDateString?: string;
  payeeNodeKey?: string;
  signature?: string;
  recoveryFlag?: number;
  tags: Array<{
    tagName: string;
    data: TagData;
  }>;
};

export type IInvoiceDecodedResponse = PaymentRequestObject & {
  tagsObject: TagsObject;
};

export type IHistoryItem = InvoiceType & {
  txid: string;
  owner: string;
  signer: string;
  nonce: any;
  actions: {
    type: IDecodedTxActionType;
    direction: IDecodedTxDirection;
  }[];
  fee: number;
  status: IDecodedTxStatus;
  origin_status: string;
};

export enum InvoiceStatusEnum {
  StateSettled = 'settled',
  StateInitialized = 'initialized',
  StateOpen = 'open',
  StateError = 'error',
}

export type IInvoiceConfig = {
  maxReceiveAmount: number;
  maxSendAmount: number;
};
