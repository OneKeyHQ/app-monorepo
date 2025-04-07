export enum EChangeHistoryEntityType {
  Wallet = 'wallet',
  Account = 'account',
  IndexedAccount = 'indexedAccount',
  AddressBook = 'addressBook',
  BrowserBookmark = 'browserBookmark',
}

export enum EChangeHistoryContentType {
  Name = 'name',
  // Memo = 'memo',
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
