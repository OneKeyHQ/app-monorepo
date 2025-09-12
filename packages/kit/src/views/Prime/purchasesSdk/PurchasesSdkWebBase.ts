import { LogLevel, Purchases } from '@revenuecat/purchases-js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';

import purchaseSdkUtils from './purchaseSdkUtils';
import { PurchasesSdkBase } from './PurchasesSdkBase';

import type { IPurchasePackageParams } from './PurchasesSdkBase';
import type {
  CustomerInfo,
  Package,
  PurchaseParams,
  PurchaseResult,
} from '@revenuecat/purchases-js';

export abstract class PurchasesSdkWebBase extends PurchasesSdkBase {
  override async configureWithLogin(params: {
    apiKey: string;
    userId: string;
  }): Promise<void> {
    // TODO VPN required
    // await Purchases.setProxyURL('https://api.rc-backup.com/');

    // TODO how to configure another userId when user login with another account
    // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id
    const { apiKey, userId } = params;
    if (!userId) {
      throw new OneKeyLocalError('No userId found');
    }
    Purchases.configure(apiKey, userId);
  }

  override async setDefaultLogLevel(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      Purchases.setLogLevel(LogLevel.Verbose);
    }
  }

  override async getCustomerInfoBase(): Promise<CustomerInfo> {
    const customerInfo: CustomerInfo =
      await Purchases.getSharedInstance().getCustomerInfo();
    console.log('customerInfo >>>>>> ', customerInfo);
    return customerInfo;
  }

  override async getPaywallPackagesBase(): Promise<Package[]> {
    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });
    const packages: Package[] = [];

    // Object.values(offerings.all).forEach((offering) => {
    //   packages.push(...offering.availablePackages);
    // });
    packages.push(...(offerings?.current?.availablePackages || []));
    packages.sort((a) => {
      // Yearly is the first
      if (
        a.rcBillingProduct.presentedOfferingContext.offeringIdentifier ===
        'Yearly'
      ) {
        return -1;
      }
      return 1;
    });
    return packages;
  }

  override async purchasePackageBase(
    params: IPurchasePackageParams,
  ): Promise<PurchaseResult> {
    try {
      await this.configureDonePromise.ready;
      const { packageId, email, locale } = params;
      // const offerings = await this.getPaywallOfferings();
      // const paywallPackage = offerings?.all?.monthly?.packagesById?.[packageId];
      const packages = await this.getPaywallPackages();
      const paywallPackage = packages.find((p) => p.identifier === packageId);
      if (!paywallPackage) {
        throw new OneKeyLocalError(
          'purchasePaywallPackage ERROR: Invalid packageId',
        );
      }
      const purchaseParams: PurchaseParams = {
        rcPackage: paywallPackage,
        customerEmail: email,
        selectedLocale: purchaseSdkUtils.convertToRevenuecatLocale({
          locale: locale as ILocaleJSONSymbol,
        }),
      };
      // TODO check package user is Matched to privyUserId
      // TODO check if user has already purchased
      const purchase = await Purchases.getSharedInstance().purchase(
        purchaseParams,
      );
      // test credit card
      // https://docs.stripe.com/testing#testing-interactively
      // Mastercard: 5555555555554444
      // visa: 4242424242424242
      console.log('purchase >>>>>> ', purchase);
      return purchase;
    } catch (error) {
      console.error('purchasePackageBase ERROR >>>>>> ', error);
      throw error;
    }
  }

  async getAppUserId(): Promise<string> {
    return Purchases.getSharedInstance().getAppUserId();
  }
}
