import type {
  CustomerInfo as CustomerInfoWeb,
  Package,
  PurchaseResult,
} from '@revenuecat/purchases-js';
import type {
  CustomerInfo as CustomerInfoNative,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal';

export type IUsePrimePayment = {
  isReady: boolean;
  getCustomerInfo: () => Promise<CustomerInfoWeb | CustomerInfoNative>;
  getPaywallPackagesNative:
    | (() => Promise<{
        packages: PurchasesPackage[];
      }>)
    | undefined;
  getPaywallPackagesWeb:
    | (() => Promise<{
        packages: Package[];
      }>)
    | undefined;
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
