import type { SecretKey } from '@cmdcode/crypto-utils';
import type { Bytes, Networks, ScriptData } from '@cmdcode/tapscript';
import type { TxTemplate } from '@cmdcode/tapscript/dist/types/schema/types';

export type { Bytes, Networks, ScriptData, TxTemplate, SecretKey };
export type IInscriptionCategoryType =
  | 'domain'
  | 'text'
  | 'file'
  | 'brc20_deploy'
  | 'brc20_mint';
export type IInscriptionContent = {
  name: string;
  hex: string;
  mimetype: string;
  sha256: string; // without 0x prefix
  previewText: string;
  categoryType: IInscriptionCategoryType;
};
export type IInscriptionContentLite = Omit<
  IInscriptionContent,
  'hex' | 'sha256'
>;
export type IInscriptionHistory = {
  createdAt: number;
  txid: string;
  from: string;
  to: string;
  fee: number;
  paddingSats: number;
  previewText: string;
  mimetype: string;
  categoryType: IInscriptionCategoryType;
  name: string;
};
export type ITaprootAddressInfo = {
  address: string;
  tapKey: string;
  scriptPubKey: string;
};
export type ITaprootAddressInfoInscription = ITaprootAddressInfo & {
  leaf: string;
  cBlock: string;
};
export type IInscriptionRedeemInfo = {
  inscription: IInscriptionPayload;
};
export type IInscriptionInitRedeemInfo = {
  addressInfo: ITaprootAddressInfoInscription;
  script: ScriptData;
  paddingSats: number;
  internalTransferFees: number;
  inscriptions: IInscriptionPayload[];
};
export type IInscriptionPayload = {
  addressInfo: ITaprootAddressInfoInscription;
  script: ScriptData;
  dataLength: number;
  scriptLength: number;
  content: IInscriptionContentLite;
  txsize: number;
  fee: number; // TODO use string?
  paddingSats: number; // TODO use string?
  toAddressScriptPubKey: string;
};
export type ITaprootTransactionInput = {
  txid: string;
  vout: number;
  prevout: {
    value: number; // TODO use string?
    scriptPubKey: string;
  };
  witness: any[];
};
export type ITaprootTransactionOutput = {
  value: number;
  scriptPubKey: string;
};
export type ITaprootTransaction = {
  version: number;
  locktime: number;
  input: Array<ITaprootTransactionInput>;
  output: Array<ITaprootTransactionOutput>;
};
export type ITaprootTransactionReceivedMoneyInfo = {
  txid: string;
  vout: number;
  amt: string;
};
export type IInscriptionsOrder = {
  network: Networks;
  fundingAddressInfo: ITaprootAddressInfo | undefined;
  fundingAddress: string;
  fundingValue: number;
  fundingValueNative: string;
  initRedeemInfo?: IInscriptionInitRedeemInfo; // TODO remove
  inscriptions: IInscriptionPayload[];
  totalFees: number;
  internalTransferFees: number;
  toAddressScriptPubKey: string;
  toAddressTapKey: string;
  toAddress: string;
  paddingSats: number;
  createdAt: number;
};
