// 独立的 mock server 类型定义，不依赖外部包

export enum EPrimeCloudSyncDataType {
  Wallet = 'Wallet',
  Account = 'Account',
  IndexedAccount = 'IndexedAccount',
  Lock = 'Lock',
  BrowserBookmark = 'BrowserBookmark',
  MarketWatchList = 'MarketWatchList',
  CustomRpc = 'CustomRpc',
  CustomToken = 'CustomToken',
  CustomNetwork = 'CustomNetwork',
  AddressBook = 'AddressBook',
}

export type ICloudSyncServerItem = {
  data: string;
  dataTimestamp: number | undefined;
  dataType: EPrimeCloudSyncDataType;
  isDeleted: boolean;
  pwdHash: string;
  key: string;
};

export type ICloudSyncServerItemByDownloaded = {
  data: string;
  dataTimestamp: number;
  dataType: EPrimeCloudSyncDataType;
  isDeleted: boolean;
  pwdHash: string;
  key: string;
};

export type ICloudSyncCheckServerStatusPostData = {
  localData: {
    key: string;
    dataTimestamp: number | undefined;
    dataType: EPrimeCloudSyncDataType;
  }[];
  onlyCheckLocalDataType: EPrimeCloudSyncDataType[];
};

export type ICloudSyncCheckServerStatusResult = {
  deleted: string[];
  diff: ICloudSyncServerItem[];
  updated: ICloudSyncServerItem[];
  obsoleted: string[];
  pwdHash: string;
  serverTime: number;
};

export type ICloudSyncDownloadPostData = {
  start?: number;
  limit?: number;
  includeDeleted?: boolean;
};

export type ICloudSyncDownloadResult = {
  nonce: number;
  serverData: ICloudSyncServerItemByDownloaded[];
  pwdHash: string;
};

export type ICloudSyncUploadPostData = {
  localData: ICloudSyncServerItem[];
  pwdHash: string;
  lock?: ICloudSyncServerItem | null | undefined;
};

export type ICloudSyncUploadResult = {
  nonce: number;
  created: number;
  updated: number;
};

export type IApiClientResponse<T> = {
  code: number;
  message: string;
  data: T | null;
};
