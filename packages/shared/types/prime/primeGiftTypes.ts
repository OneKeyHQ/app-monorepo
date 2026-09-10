import type { SearchDevice } from '@onekeyfe/hd-core';

export type IPrimeGiftDevice = Omit<SearchDevice, 'commType'>;

export type IPrimeGiftEligibility = {
  sno: string;
  eligible: boolean;
  hasUnclaimedGift: boolean;
  giftDays: number;
  giftMonths?: number | null | '';
};

export type IPrimeGiftClaimParams = {
  device: IPrimeGiftDevice;
  serialNo: string;
  expectedOneKeyUserId: string;
};

export type IPrimeGiftPreparedRedemption = {
  serialNo: string;
  onekeyUserId: string;
  code?: string;
  verification: IPrimeGiftDeviceVerification;
};

// Normalized result; the code is passed only to the redemption dialog, never persisted.
export type IPrimeGiftVerifyV2Result = {
  code?: string;
  status?: string;
};

export type IPrimeGiftDeviceVerification = {
  hasCode: boolean;
  status?: string;
};

export type IPrimeGiftClaimResult = {
  serialNo: string;
  giftMonths?: IPrimeGiftEligibility['giftMonths'];
  addedDays: number;
  finalExpiresAt: number;
  onekeyUserId: string;
  email?: string;
};
