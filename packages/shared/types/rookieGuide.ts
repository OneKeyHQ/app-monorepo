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

// ============ Rookie Share Types ============

// Data passed from H5 WebView for sharing
export interface IRookieShareData {
  // Content card
  imageUrl: string; // Badge/avatar image URL (required)
  title: string; // Main title (required)
  subtitle?: string; // Subtitle (optional)

  // Footer area
  footerText?: string; // Footer text, defaults to "Open source and easy to use from day one."
  referralCode?: string; // Referral code (displayed in Footer)
  referralUrl?: string; // Referral URL (used for QR code generation)
}

export interface IRookieShareImageGeneratorRef {
  generate: () => Promise<string>; // Returns Base64 PNG
}
