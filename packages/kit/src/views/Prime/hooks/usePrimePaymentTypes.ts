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
  pricePerMonthString: string;
  pricePerYearString: string;
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
        subscriptionPeriod: string;
        email: string;
        locale?: string;
      }) => Promise<PurchaseResult>)
    | undefined;
};
