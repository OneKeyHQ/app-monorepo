export type IInternalTransferSource = 'trading' | 'perps' | 'spot';

export interface IInternalTransferAccount {
  userAccountId: string;
  expectedAccountAddress: string;
}

export interface IInternalTransferToken {
  id: string;
  index: number;
  symbol: string;
  token: string;
  decimals: number;
  balance: string;
  usdValue: string;
}

export interface IInternalTransferTokenParams extends IInternalTransferAccount {
  source: IInternalTransferSource;
  selectedTokenId?: string;
}

export interface IInternalTransferQuoteParams extends IInternalTransferAccount {
  destination: string;
  source: IInternalTransferSource;
  tokenId: string;
}

export interface IInternalTransferQuote extends IInternalTransferQuoteParams {
  sourceDex: '' | 'spot';
  destinationDex: '' | 'spot';
  fee: string;
  userHasSentTx?: boolean;
  asset: IInternalTransferToken;
  maxAmount: string;
}

export interface IInternalTransferParams extends IInternalTransferQuoteParams {
  amount: string;
  expectedSourceDex: '' | 'spot';
  expectedFee: string;
  expectedUserHasSentTx?: boolean;
  expectedToken: string;
  expectedDestinationDex: '' | 'spot';
}

export interface IInternalTransferPending {
  nonce: number;
  destination: string;
  amount: string;
  sourceDex: '' | 'spot';
  token?: string;
  symbol?: string;
  // Older attempts always sent to spot.
  destinationDex?: '' | 'spot';
}
