export type IRevenueCatCustomerInfo = {
  managementURL: string | null;
  entitlements: {
    active: Record<
      string,
      {
        isActive: boolean;
        willRenew: boolean;
        isSandbox: boolean;
        expirationDateMillis: number | null;
      }
    >;
  };
};

export type IRevenueCatPackage = {
  identifier: string;
  presentedOfferingContext: { offeringIdentifier: string } | null;
  product: {
    identifier: string;
    subscriptionPeriod: string | null;
    pricePerYear: number | null;
    pricePerMonth: number | null;
    currencyCode: string;
    introPrice: {
      price: number;
      period: string;
      periodUnit: string;
      periodNumberOfUnits: number;
    } | null;
  };
};

export type IRevenueCatOfferings = {
  current: { availablePackages: IRevenueCatPackage[] } | null;
};

export type IRevenueCatPurchaseResult = {
  customerInfo: IRevenueCatCustomerInfo;
};

export type IRevenueCatRequestMap = {
  configure: { apiKey: string };
  logIn: { appUserId: string };
  logOut: undefined;
  getAppUserId: undefined;
  getCustomerInfo: { expectedAppUserId: string };
  getOfferings: undefined;
  purchasePackage: {
    packageIdentifier: string;
    offeringIdentifier: string;
    expectedAppUserId: string;
  };
  restorePurchases: { expectedAppUserId: string };
  checkTrialOrIntroductoryPriceEligibility: { productIdentifiers: string[] };
  setAttributes: {
    attributes: Record<string, string>;
    expectedAppUserId: string;
  };
};

export type IRevenueCatResultMap = {
  configure: void;
  logIn: void;
  logOut: void;
  getAppUserId: string;
  getCustomerInfo: IRevenueCatCustomerInfo;
  getOfferings: IRevenueCatOfferings;
  purchasePackage: IRevenueCatPurchaseResult;
  restorePurchases: IRevenueCatCustomerInfo;
  checkTrialOrIntroductoryPriceEligibility: Record<string, { status: number }>;
  setAttributes: void;
};

export type IRevenueCatMethod = keyof IRevenueCatRequestMap;

export interface IRevenueCatDesktopClient {
  isAvailable(): boolean;
  invoke<K extends IRevenueCatMethod>(
    method: K,
    params: IRevenueCatRequestMap[K],
  ): Promise<IRevenueCatResultMap[K]>;
}
