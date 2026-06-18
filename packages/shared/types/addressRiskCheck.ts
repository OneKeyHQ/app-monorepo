import type { EKytRiskLevel, IKytRiskFactor } from './kyt';

// A network the server allows for active address risk check. The client renders
// the list from the server (never hardcodes the MistTrack coin mapping).
export type IAddressRiskCheckNetwork = {
  networkId: string;
  networkName: string;
};

// Response of POST /prime/v1/kyt/address-risk/check (MistTrack risk_score).
// `reasons[]` reuses the KYT risk factor shape; known category keys are
// localized on the client.
export type IAddressRiskCheckResult = {
  networkId: string;
  address: string;
  provider: string;
  level: EKytRiskLevel;
  checkedAt: number;
  cached: boolean;
  score?: number;
  reasons: IKytRiskFactor[];
  reportUrl?: string;
};

export type IAddressRiskCheckActivity = {
  totalTxs: number;
  firstActiveAt: number;
  lastActiveAt: number;
  receivedTxs: number;
  sentTxs: number;
  receivedSentRatio: string;
  balance: string;
  balanceSymbol: string;
};

export type IAddressRiskCheckPlatformGroup = {
  count: number;
  list: string[];
};

export type IAddressRiskCheckPlatformProfile = Record<
  'exchanges' | 'dex' | 'mixer' | 'nft',
  IAddressRiskCheckPlatformGroup
>;

export type IAddressRiskCheckRiskIntelligence = Record<
  'phishing' | 'ransom' | 'theft' | 'laundering',
  IAddressRiskCheckPlatformGroup
>;

// Response of POST /prime/v1/kyt/address-risk/details
// (MistTrack address_overview + address_trace), loaded lazily on demand.
export type IAddressRiskCheckDetails = {
  networkId: string;
  address: string;
  provider: string;
  checkedAt: number;
  cached: boolean;
  activity: IAddressRiskCheckActivity;
  platformProfile: IAddressRiskCheckPlatformProfile;
  riskIntelligence: IAddressRiskCheckRiskIntelligence;
};

// Local-only "Recent checks" record. Stored on-device, never bound to OneKey ID.
export type IAddressRiskCheckRecentItem = {
  networkId: string;
  address: string;
  level: EKytRiskLevel;
  // Server-reported check time (may be a cached timestamp); shown in the row.
  checkedAt: number;
  // Local timestamp of the user's most recent query; used for list ordering so
  // re-checking an address moves it back to the top regardless of server cache.
  updatedAt: number;
};
