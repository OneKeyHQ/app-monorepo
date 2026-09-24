import type {
  IRevenueCatCustomerInfo,
  IRevenueCatPackage,
  IRevenueCatPurchaseResult,
} from '@onekeyhq/shared/types/prime/revenueCat';

export type IPrimeStorePurchasesSdk<TPackage extends IRevenueCatPackage> = {
  configure: (params: { apiKey: string }) => Promise<void>;
  logIn: (appUserId: string) => Promise<unknown>;
  getAppUserID: () => Promise<string>;
  getCustomerInfo: (
    expectedAppUserId: string,
  ) => Promise<IRevenueCatCustomerInfo>;
  getOfferings: () => Promise<{
    current: { availablePackages: TPackage[] } | null;
  }>;
  purchasePackage: (
    offering: TPackage,
    expectedAppUserId: string,
  ) => Promise<IRevenueCatPurchaseResult>;
  restorePurchases: (
    expectedAppUserId: string,
  ) => Promise<IRevenueCatCustomerInfo>;
  setMixpanelDistinctID: (
    instanceId: string,
    expectedAppUserId: string,
  ) => Promise<void>;
  setAttributes: (
    attributes: Record<string, string>,
    expectedAppUserId: string,
  ) => Promise<void>;
  getIntroEligibleProductIds: (
    packages: TPackage[],
  ) => Promise<ReadonlySet<string> | undefined>;
  getRecurringPriceUnit: () => 'major' | 'micros';
};
