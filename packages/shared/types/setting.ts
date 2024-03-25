export type IClearCacheOnAppState = {
  tokenAndNFT: boolean;
  transactionHistory: boolean;
  swapHistory: boolean;
  browserCache: boolean;
  browserHistory: boolean;
  connectSites: boolean;
};

export enum EReasonForNeedPassword {
  CreateOrRemoveWallet = 'CreateOrRemoveWallet',
  CreateTransaction = 'CreateTransaction',
  LightningNetworkAuth = 'LightningNetworkAuth',
}
