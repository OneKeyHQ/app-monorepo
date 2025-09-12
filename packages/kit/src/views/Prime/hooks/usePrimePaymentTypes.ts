import type {
  CustomerInfo as CustomerInfoWeb,
  PurchaseResult,
} from '@revenuecat/purchases-js';
import type {
  CustomerInfo as CustomerInfoNative,
  MakePurchaseResult,
} from '@revenuecat/purchases-typescript-internal';

export type ISubscriptionPeriod = 'P1Y' | 'P1M';

export type IPackage = {
  subscriptionPeriod: ISubscriptionPeriod;
  pricePerMonth: number;
  pricePerMonthString: string;
  pricePerYear: number;
  pricePerYearString: string;
  priceTotalPerYearString: string;
};

export type IRevenueCatCustomerInfoWeb = CustomerInfoWeb;
export type IRevenueCatCustomerInfoNative = CustomerInfoNative;

export type IUsePrimePayment = {
  isReady: boolean;
  getCustomerInfo: () => Promise<
    IRevenueCatCustomerInfoWeb | IRevenueCatCustomerInfoNative
  >;
  getPackagesNative: (() => Promise<IPackage[]>) | undefined;
  getPackagesWeb: (() => Promise<IPackage[]>) | undefined;
  restorePurchases: (() => Promise<void>) | undefined;
  webEmbedQueryParams?: {
    apiKey: string;
    primeUserId: string;
    primeUserEmail: string;
    subscriptionPeriod: ISubscriptionPeriod;
    locale: string;
    mode: 'dev' | 'prod';
  };
  purchasePackageNative:
    | (({
        subscriptionPeriod,
      }: {
        subscriptionPeriod: ISubscriptionPeriod;
      }) => Promise<MakePurchaseResult>)
    | undefined;
  purchasePackageWeb:
    | (({
        subscriptionPeriod,
        email,
        locale,
      }: {
        subscriptionPeriod: ISubscriptionPeriod;
        email: string;
        locale?: string;
      }) => Promise<PurchaseResult>)
    | undefined;
};
