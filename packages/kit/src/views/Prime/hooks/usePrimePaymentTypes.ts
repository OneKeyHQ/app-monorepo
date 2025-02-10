import type {
  CustomerInfo as CustomerInfoWeb,
  Package,
  PurchaseResult,
} from '@revenuecat/purchases-js';
import type {
  CustomerInfo as CustomerInfoNative,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal';
import type { PAYWALL_RESULT } from 'react-native-purchases-ui';

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
  presentPaywallNative: (() => Promise<PAYWALL_RESULT>) | undefined;
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
