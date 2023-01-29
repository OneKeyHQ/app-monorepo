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
}

export enum ReceiverErrorEnum {
  IcorrectFormat = 'IcorrectFormat',
  IcorrectAddress = 'IcorrectAddress',
}

export type BulkSenderRoutesParams = {
  [BulkSenderRoutes.TokenSelector]: {
    accountId: string;
    networkId: string;
    tokens: Token[];
    onTokenSelected: (token: Token) => void;
  };
};

export type TokenReceiver = {
  Address: string;
  Amount: string;
};

export type ReceiverError = {
  lineNumber: number;
  type: ReceiverErrorEnum;
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
