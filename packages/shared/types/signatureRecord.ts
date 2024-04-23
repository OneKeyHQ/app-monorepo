import type { IServerNetwork } from '.';

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

export type ITransactionType = 'send' | 'approve' | 'swap' | 'stake';
interface IBaseTransactionData {
  type: ITransactionType;
}

export interface ISendTransactionData extends IBaseTransactionData {
  type: 'send';
  amount: string;
  token: IBaseToken;
}

export interface IApproveTransactionData extends IBaseTransactionData {
  type: 'approve';
  amount: string;
  token: IBaseToken;
  isUnlimited?: boolean;
}

export interface ISwapTransactionData extends IBaseTransactionData {
  type: 'swap';
  fromNetworkId: string;
  fromAmount: string;
  fromToken: IBaseToken;
  toAmount: string;
  toNetworkId: string;
  toToken: IBaseToken;
}

export type IBaseSignedTransaction = {
  networkId: string;
  title: string;
  address: string;
  hash: string;
};

export type IBaseSignedTransactionData = {
  data: ISendTransactionData | IApproveTransactionData | ISwapTransactionData;
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
  title: string;
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
