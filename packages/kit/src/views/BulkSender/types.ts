import type { Token } from '@onekeyhq/engine/src/types/token';

export enum BulkSenderTypeEnum {
  NativeToken = 'NativeToken',
  Token = 'Token',
  NFT = 'NFT',
}

export enum TokenReceiverEnum {
  Address = 'Address',
  Amount = 'Amount',
}

export enum BulkSenderRoutes {
  TokenSelector = 'TokenSelectorModal',
  AmountEditor = 'AmountEditorModal',
}

export enum ReceiverExampleType {
  TXT = 'TXT',
  CSV = 'CSV',
  Excel = 'Excel',
}

export type BulkSenderRoutesParams = {
  [BulkSenderRoutes.TokenSelector]: {
    accountId: string;
    networkId: string;
    tokens: Token[];
    onTokenSelected: (token: Token) => void;
  };
  [BulkSenderRoutes.AmountEditor]: {
    onAmountChanged: (amount: string) => void;
  };
};

export type TokenReceiver = {
  Address: string;
  Amount: string;
  LinerNumber?: number;
};

export type NFTReceiver = {
  Address: string;
  Amount: string;
  TokenId: string;
  LinerNumber?: number;
};

export type ReceiverError = {
  lineNumber: number;
  message: string;
};

export type ReceiverInputParams = {
  accountId: string;
  networkId: string;
  receiverFromOut: TokenReceiver[];
  setReceiverFromOut: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  setReceiver: React.Dispatch<React.SetStateAction<TokenReceiver[]>>;
  type: BulkSenderTypeEnum;
  receiverErrors: ReceiverError[];
  isUploadMode: boolean;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
};
