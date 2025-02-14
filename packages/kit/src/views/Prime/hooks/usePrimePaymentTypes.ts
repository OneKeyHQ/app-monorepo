import type {
  CustomerInfo as CustomerInfoWeb,
  PurchaseResult,
} from '@revenuecat/purchases-js';
import type {
  CustomerInfo as CustomerInfoNative,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal';

export type ISubscriptionPeriod = 'P1Y' | 'P1M';

export type IPrimeSubscriptionPlan = {
  subscriptionPeriod: ISubscriptionPeriod;
  pricePerMonthString: string;
  pricePerYearString: string;
};

export type IUsePrimePayment = {
  isReady: boolean;
  getCustomerInfo: () => Promise<CustomerInfoWeb | CustomerInfoNative>;
  getPaywallPackagesNative:
    | (() => Promise<{
        packages: PurchasesPackage[];
      }>)
    | undefined;
  getPrimeSubscriptionPlanWeb:
    | (() => Promise<IPrimeSubscriptionPlan[]>)
    | undefined;
  // getPaywallPackageBySubscriptionPeriod:
  //   | ((subscriptionPeriod: ISubscriptionPeriod) => Package)
  //   | undefined;
  presentPaywallNative: (() => Promise<boolean>) | undefined;
  purchasePaywallPackageWeb:
    | (({
        packageId,
        email,
        locale,
      }: {
        packageId: string;
        email: string;
        locale?: string;
      }) => Promise<PurchaseResult>)
    | undefined;
};
