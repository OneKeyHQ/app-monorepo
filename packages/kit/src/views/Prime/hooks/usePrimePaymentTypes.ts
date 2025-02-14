import type {
  CustomerInfo as CustomerInfoWeb,
  PurchaseResult,
} from '@revenuecat/purchases-js';
import type {
  CustomerInfo as CustomerInfoNative,
  MakePurchaseResult,
} from '@revenuecat/purchases-typescript-internal';

export type IPackageId = 'P1Y' | 'P1M';

export type IPackage = {
  packageId: IPackageId;
  pricePerMonthString: string;
  pricePerYearString: string;
};

export type IUsePrimePayment = {
  isReady: boolean;
  getCustomerInfo: () => Promise<CustomerInfoWeb | CustomerInfoNative>;
  getPackagesNative: (() => Promise<IPackage[]>) | undefined;
  getPackagesWeb: (() => Promise<IPackage[]>) | undefined;
  purchasePackageNative:
    | (({
        packageId,
      }: {
        packageId: IPackageId;
      }) => Promise<MakePurchaseResult>)
    | undefined;
  purchasePackageWeb:
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
