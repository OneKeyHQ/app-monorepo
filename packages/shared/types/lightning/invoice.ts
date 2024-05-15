/* eslint-disable spellcheck/spell-checker */
import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

export type ICreateInvoiceParams = {
  amount: number;
  description?: string;
  description_hash?: string;
};

export type ICreateInvoiceResponse = IOneKeyAPIBaseResponse<{
  expires_at: string;
  payment_hash: string;
  payment_request: string;
}>;

export type IInvoiceType = {
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

type IRoutingInfo = Array<{
  pubkey: string;
  short_channel_id: string;
  fee_base_msat: number;
  fee_proportional_millionths: number;
  cltv_expiry_delta: number;
}>;
type IFallbackAddress = {
  code: number;
  address: string;
  addressHash: string;
};
type IFeatureBits = {
  word_length: number;
  option_data_loss_protect?: IFeature;
  initial_routing_sync?: IFeature;
  option_upfront_shutdown_script?: IFeature;
  gossip_queries?: IFeature;
  var_onion_optin?: IFeature;
  gossip_queries_ex?: IFeature;
  option_static_remotekey?: IFeature;
  payment_secret?: IFeature;
  basic_mpp?: IFeature;
  option_support_large_channel?: IFeature;
  extra_bits?: {
    start_bit: number;
    bits: boolean[];
    has_required?: boolean;
  };
};
type IFeature = {
  required?: boolean;
  supported?: boolean;
};
type INetwork = {
  [index: string]: any;
  bech32: string;
  pubKeyHash: number;
  scriptHash: number;
  validWitnessVersions: number[];
};
type IUnknownTag = {
  tagCode: number;
  words: string;
};

// Start exports
export declare type ITagData =
  | string
  | number
  | IRoutingInfo
  | IFallbackAddress
  | IFeatureBits
  | IUnknownTag;
export declare type ITagsObject = {
  payment_hash?: string;
  payment_secret?: string;
  description?: string;
  payee_node_key?: string;
  purpose_commit_hash?: string;
  expire_time?: number;
  min_final_cltv_expiry?: number;
  fallback_address?: IFallbackAddress;
  routing_info?: IRoutingInfo;
  IFeature_bits?: IFeatureBits;
  unknownTags?: IUnknownTag[];
};
export declare type IPaymentRequestObject = {
  paymentRequest?: string;
  complete?: boolean;
  prefix?: string;
  wordsTemp?: string;
  network?: INetwork;
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
    data: ITagData;
  }>;
};

export type IInvoiceDecodedResponse = IPaymentRequestObject & {
  tagsObject: ITagsObject;
};

export type IInvoiceConfig = {
  maxReceiveAmount: number;
  maxSendAmount: number;
};
