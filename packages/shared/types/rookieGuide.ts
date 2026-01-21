export enum ERookieTaskType {
  DEPOSIT = 'deposit',
  MARKET = 'market',
  SWAP = 'swap',
  PERPS = 'perps',
  DAPP = 'dapp',
}

// Task progress: key existence indicates completion, value is timestamp
export interface IRookieGuideProgress {
  [ERookieTaskType.DEPOSIT]?: number;
  [ERookieTaskType.MARKET]?: number;
  [ERookieTaskType.SWAP]?: number;
  [ERookieTaskType.PERPS]?: number;
  [ERookieTaskType.DAPP]?: number;
}

// Data stored in SimpleDB
export interface IRookieGuideData {
  isActivated?: boolean; // true after user opens the guide page
  progress: IRookieGuideProgress;
}

export interface IRookieGuideOneKeyIdInfo {
  isLoggedIn: boolean;
  email?: string;
  userId?: string;
}

export interface IRookieGuideInfo {
  fiatBalance: string;
  currency: string;
  oneKeyId: IRookieGuideOneKeyIdInfo;
  instanceId: string;
  taskProgress: IRookieGuideProgress;
}
