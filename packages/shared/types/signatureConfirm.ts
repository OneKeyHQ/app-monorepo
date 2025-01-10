import type { IBadgeType } from '@onekeyhq/components';

import type { IAccountNFT } from './nft';
import type { IToken, ITokenFiat } from './token';

export enum EParseTxComponentType {
  Default = 'default',
  Network = 'network',
  Address = 'address',
  NFT = 'nft',
  Amount = 'amount',
  Token = 'token',
  Assets = 'assets',
  Approve = 'tokenApproval',
  Divider = 'divider',
}

export enum EParseTxType {
  Unknown = 'unknown',
}

export interface IDisplayComponentDivider {
  type: EParseTxComponentType.Divider;
}

export interface IDisplayComponentNetwork {
  type: EParseTxComponentType.Network;
  label: string;
  networkId: string;
}

export interface IDisplayComponentAddress {
  type: EParseTxComponentType.Address;
  label: string;
  address: string;
  tags: {
    value: string;
    displayType: IBadgeType;
  }[];
  isNavigable?: boolean;
}

export interface IDisplayComponentAmount {
  type: EParseTxComponentType.Amount;
  label: string;
  amount: string;
}

export interface IDisplayComponentNFT {
  type: EParseTxComponentType.NFT;
  label: string;
  nft: IAccountNFT;
  amount: string;
}

export interface IDisplayComponentToken {
  type: EParseTxComponentType.Token;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount: string;
  amountParsed: string;
  networkId: string;
  showNetwork: boolean;
}

export interface IDisplayComponentAssets {
  type: EParseTxComponentType.Assets;
  label: string;
  name: string;
  icon: string;
  symbol: string;
  amount: string;
  amountParsed: string;
  networkId?: string;
  isNFT?: boolean;
}

export interface IDisplayComponentApprove {
  type: EParseTxComponentType.Approve;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount?: string;
  amountParsed: string;
  balance?: string;
  balanceParsed?: string;
  isEditable: boolean;
  isInfiniteAmount: boolean;
  networkId: string;
  showNetwork: boolean;
}

export interface IDisplayComponentDefault {
  type: EParseTxComponentType.Default;
  label: string;
  value: string;
}

export type IDisplayComponent =
  | IDisplayComponentDivider
  | IDisplayComponentAssets
  | IDisplayComponentToken
  | IDisplayComponentApprove
  | IDisplayComponentNFT
  | IDisplayComponentNetwork
  | IDisplayComponentAddress
  | IDisplayComponentDefault;

export interface ITransactionData {
  name: string;
  args: string[];
  textSignature: string;
  hexSignature: string;
}

export interface ITransactionDisplay {
  title: string;
  components: IDisplayComponent[];
  alerts: string[];
}

export interface IParseTransactionResp {
  accountAddress: string;
  parsedTx: {
    to: {
      address: string;
      name: null | string;
      labels: null | string[];
      isContract: boolean;
      riskLevel: number;
    };
    data: ITransactionData;
  };
  display: ITransactionDisplay;
  type: EParseTxType;
}
