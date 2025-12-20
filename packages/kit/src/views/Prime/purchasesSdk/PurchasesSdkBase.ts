import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';

import type {
  CustomerInfo,
  Package,
  PurchaseResult,
} from '@revenuecat/purchases-js';

export type IPurchasePackageParams = {
  packageId: string;
  email: string; // auto filled payment email
  locale?: string;
  userId: string;
};

export abstract class PurchasesSdkBase {
  configureDonePromise = createPromiseTarget<boolean>();

  abstract getApiKey(): Promise<string>;

  abstract getAppUserId(): Promise<string>;

  abstract configureWithLogin(params: {
    apiKey: string;
    userId: string;
  }): Promise<void>;

  abstract setDefaultLogLevel(): Promise<void>;

  abstract getCustomerInfoBase(): Promise<CustomerInfo>;

  abstract getPaywallPackagesBase(): Promise<Package[]>;

  abstract purchasePackageBase(
    params: IPurchasePackageParams,
  ): Promise<PurchaseResult>;

  async login(params: { userId: string }): Promise<void> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new OneKeyLocalError('No REVENUECAT api key found');
    }
    if (!params.userId) {
      throw new OneKeyLocalError('No userId found');
    }
    await this.setDefaultLogLevel();
    await this.configureWithLogin({ apiKey, userId: params.userId });
    this.configureDonePromise.resolveTarget(true);
  }

  async ensureUserIdMatched(userId: string) {
    if (!userId) {
      throw new OneKeyLocalError('No userId found');
    }
    const appUserId = await this.getAppUserId();
    if (appUserId !== userId) {
      throw new OneKeyLocalError('AppUserId not match');
    }
  }

  async getCustomerInfo(params: { userId: string }): Promise<CustomerInfo> {
    await this.login({ userId: params.userId });
    await this.ensureUserIdMatched(params.userId);
    const customerInfo = await this.getCustomerInfoBase();
    return customerInfo;
  }

  async getPaywallPackages() {
    await this.configureDonePromise.ready;
    return this.getPaywallPackagesBase();
  }

  async purchasePackage(params: IPurchasePackageParams) {
    await this.configureDonePromise.ready;
    await this.ensureUserIdMatched(params.userId);
    return this.purchasePackageBase(params);
  }
}
