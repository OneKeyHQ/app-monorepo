export enum EChangeHistoryEntityType {
  Wallet = 'wallet',
  Account = 'account',
  IndexedAccount = 'indexedAccount',
  AddressBook = 'addressBook',
  BrowserBookmark = 'browserBookmark',
  PrimeTransfer = 'primeTransfer',
}

export enum EChangeHistoryContentType {
  Name = 'name',
  // Memo = 'memo',
  ServerUrl = 'serverUrl',
}

export interface IChangeHistoryItem {
  oldValue: string;
  value: string;
  timestamp: number;
}

export type IChangeHistoryUpdateItem = {
  entityType: EChangeHistoryEntityType;
  entityId: string;
  contentType: EChangeHistoryContentType;
  oldValue: string;
  value: string;
};
