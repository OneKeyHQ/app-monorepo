export interface IConnectionItem {
  title: string;
  origin: string;
  imageURL: string;
  connection: {
    walletId: string;
    indexedAccountId: string;
    networkId: string;
    accountId: string;
  }[];
  enabledFor: never[];
}
