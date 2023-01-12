import type { Token } from '@onekeyhq/engine/src/types/token';

export enum BulkSenderTabEnum {
  NativeToken = 'NativeToken',
  Token = 'Token',
  NFT = 'NFT',
}

export enum ReceiverEnum {
  Address = 'Address',
  Amount = 'Amount',
}

export enum BulkSenderRoutes {
  TokenSelector = 'TokenSelectorModal',
}

export type BulkSenderRoutesParams = {
  [BulkSenderRoutes.TokenSelector]: {
    accountId: string;
    networkId: string;
    tokens: Token[];
    balances: Record<string, string | undefined>;
    onTokenSelected: (token: Token) => void;
  };
};

export type TokenReceiver = {
  Address: string;
  Amount: string;
};
