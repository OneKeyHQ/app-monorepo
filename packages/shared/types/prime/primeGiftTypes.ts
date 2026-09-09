import type { SearchDevice } from '@onekeyfe/hd-core';

export type IPrimeGiftDevice = Omit<SearchDevice, 'commType'>;

export type IPrimeGiftEligibility = {
  canClaim: boolean;
  status: 'eligible' | 'redeemed' | 'unavailable';
  giftMonths: number;
  reason?: string;
};

export type IPrimeGiftAccountEligibility = {
  canClaim: boolean;
  reason?: string;
};

export type IPrimeGiftClaimProgress = {
  deviceVerified: boolean;
};

export type IPrimeGiftClaimParams = {
  device: IPrimeGiftDevice;
  serialNo: string;
  expectedOneKeyUserId: string;
};

// Internal verification response; the redemption code must remain in background.
export type IPrimeGiftVerifyV2Result = {
  serialNo: string;
  primeRedeemCode: string;
};

export type IPrimeGiftClaimResult = {
  serialNo: string;
  giftMonths: number;
  addedDays: number;
  finalExpiresAt: number;
  onekeyUserId: string;
  email?: string;
};

export type IPrimeGiftMockConfig = {
  enabled: boolean;
  serialNo: string;
  giftMonths?: number;
  redeemCode?: string;
};

export type IPrimeGiftStoredRecord = {
  giftMonths: number;
  redemptionCodeStorageKey?: string;
  codeOwnerOneKeyUserId?: string;
  claimStatus?: 'codeReady' | 'submitting' | 'resultUnknown';
  result?: IPrimeGiftClaimResult;
};

export type IPrimeGiftMockState = {
  enabled: boolean;
  devices: Record<string, IPrimeGiftStoredRecord>;
};
