export enum ERookieTaskType {
  DEPOSIT = 'deposit',
  SWAP = 'swap',
  DAPP = 'dapp',
}

// Task progress: key existence indicates completion, value is timestamp
export interface IRookieGuideProgress {
  [ERookieTaskType.DEPOSIT]?: number;
  [ERookieTaskType.SWAP]?: number;
  [ERookieTaskType.DAPP]?: number;
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
