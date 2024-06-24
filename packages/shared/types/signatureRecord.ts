import type { IServerNetwork } from '.';
import type { ELidoLabels } from './staking';

export type IBaseToken = {
  name: string;
  symbol: string;
  address: string;
  logoURI?: string;
};

export type IBaseCreatedAt = {
  createdAt: number;
};

export type IBaseSignedMessageContentType = 'text' | 'json';

export type IBaseSignedMessage = {
  networkId: string;
  title: string;
  address: string;
  contentType: IBaseSignedMessageContentType;
  message: string;
};

export type ICreateSignedMessageParams = IBaseSignedMessage;

export enum ETransactionType {
  SEND = 'send',
  APPROVE = 'approve',
  SWAP = 'swap',
  EARN = 'earn',
}

interface IBaseTransactionData {
  type: ETransactionType;
}

export interface ISendTransactionData extends IBaseTransactionData {
  type: ETransactionType.SEND;
  amount: string;
  token: IBaseToken;
}

export interface IApproveTransactionData extends IBaseTransactionData {
  type: ETransactionType.APPROVE;
  amount: string;
  token: IBaseToken;
  isUnlimited?: boolean;
}

export interface ISwapTransactionData extends IBaseTransactionData {
  type: ETransactionType.SWAP;
  fromNetworkId: string;
  fromAmount: string;
  fromToken: IBaseToken;
  toAmount: string;
  toNetworkId: string;
  toToken: IBaseToken;
}

export interface IEarnTransactionData extends IBaseTransactionData {
  type: ETransactionType.EARN;
  label: ELidoLabels;
  send?: { amount: string; token: IBaseToken };
  receive?: { amount: string; token: IBaseToken };
}

export type IBaseSignedTransaction = {
  networkId: string;
  title: string;
  address: string;
  hash: string;
};

export type IBaseSignedTransactionData = {
  data:
    | ISendTransactionData
    | IApproveTransactionData
    | ISwapTransactionData
    | IEarnTransactionData;
};

export type IBaseSignedTransactionDataStringify = {
  dataStringify: string;
};

export type ICreateSignedTransactionParams = IBaseSignedTransaction &
  IBaseSignedTransactionData;

export type IBaseConnectedSite = {
  networkIds: string[];
  addresses: string[];
  url: string;
};

export type ICreateConnectedSiteParams = IBaseConnectedSite;

export type ISignedMessage = IBaseSignedMessage &
  IBaseCreatedAt & {
    network: IServerNetwork;
  };

export type ISignedTransaction = IBaseSignedTransaction &
  IBaseSignedTransactionData &
  IBaseCreatedAt & {
    network: IServerNetwork;
  };

export type IConnectedSite = IBaseConnectedSite &
  IBaseCreatedAt & {
    logo: string;
    networks: IServerNetwork[];
  };

export type ISignatureItemQueryParams = {
  networkId?: string;
  address?: string;
  limit?: number;
  offset?: number;
};
