import type { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';

export enum TokenTraderEnum {
  Address = 'Address',
  Amount = 'Amount',
}

export enum BulkSenderRoutes {
  TokenSelector = 'TokenSelectorModal',
  AmountEditor = 'AmountEditorModal',
  IntervalEditor = 'IntervalEditorModal',
}

export enum TraderExampleType {
  TXT = 'TXT',
  CSV = 'CSV',
  Excel = 'Excel',
}

export enum AmountTypeEnum {
  All = 'All',
  Custom = 'Custom',
  Random = 'Random',
  Fixed = 'Fixed',
}

export enum TraderTypeEnum {
  Sender = 'Sender',
  Receiver = 'Receiver',
}

export enum IntervalTypeEnum {
  Off = 'Off',
  Fixed = 'Fixed',
  Random = 'Random',
}

export type BulkSenderRoutesParams = {
  [BulkSenderRoutes.TokenSelector]: {
    accountId: string;
    networkId: string;
    tokens: Token[];
    onTokenSelected: (token: Token) => void;
  };
  [BulkSenderRoutes.AmountEditor]: {
    networkId: string;
    bulkType: BulkTypeEnum;
    amount: string[];
    amountType: AmountTypeEnum;
    token: Token;
    accountAddress: string;
    onAmountChanged: ({
      amount,
      amountType,
    }: {
      amount: string[];
      amountType: AmountTypeEnum;
    }) => void;
  };
  [BulkSenderRoutes.IntervalEditor]: {
    txInterval: string[];
    intervalType: IntervalTypeEnum;
    onIntervalChanged: ({
      txInterval,
      intervalType,
    }: {
      txInterval: string[];
      intervalType: IntervalTypeEnum;
    }) => void;
  };
};

export type TokenTrader = {
  Address: string;
  Amount?: string;
  LinerNumber?: number;
};

export type NFTTrader = {
  Address: string;
  Amount: string;
  TokenId: string;
  LinerNumber?: number;
};

export type TraderError = {
  lineNumber?: number;
  message: string;
};

export type TraderInputParams = {
  header: string;
  accountId: string;
  networkId: string;
  token: Token;
  amount: string[];
  amountType: AmountTypeEnum;
  trader: TokenTrader[];
  traderFromOut: TokenTrader[];
  setTraderFromOut: React.Dispatch<React.SetStateAction<TokenTrader[]>>;
  setTrader: React.Dispatch<React.SetStateAction<TokenTrader[]>>;
  traderErrors: TraderError[];
  isUploadMode: boolean;
  isSingleMode?: boolean;
  withAmount?: boolean;
  setIsUploadMode: React.Dispatch<React.SetStateAction<boolean>>;
};

export type AmountEditorValues = {
  amount: string;
  maxAmount: string;
  minAmount: string;
};
