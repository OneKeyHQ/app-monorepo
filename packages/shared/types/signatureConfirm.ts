import type { IAccountNFT } from './nft';
import type { IToken, ITokenFiat } from './token';

export enum EParseTxComponentType {
  Network = 'network',
  Address = 'address',
  NFT = 'nft',
  Amount = 'amount',
  Token = 'token',
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
  tags: string[];
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
}

export type IDisplayComponent =
  | IDisplayComponentNetwork
  | IDisplayComponentAddress
  | IDisplayComponentNFT;

export interface ITransactionData {
  name: string;
  args: string[];
  textSignature: string;
  hexSignature: string;
}

export interface IParseTxResp {
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
  display: {
    title: string;
    components: IDisplayComponent[];
    alerts: string[];
  };
}
