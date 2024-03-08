export type IClearCacheOnAppState = {
  tokenAndNFT: boolean;
  transactionHistory: boolean;
  swapHistory: boolean;
  browserCache: boolean;
  browserHistory: boolean;
  connectSites: boolean;
};

export type IReasonForNeedPassword =
  | 'CreateOrRemoveWallet'
  | 'CreateTransaction';
