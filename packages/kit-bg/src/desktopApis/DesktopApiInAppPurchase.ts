import { inAppPurchase } from 'electron';

import type {
  IDesktopIAPGetProductsParams,
  IDesktopIAPGetProductsResult,
} from '@onekeyhq/desktop/app/config';
import { getMacAppId } from '@onekeyhq/desktop/app/libs/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IRevenueCatMethod,
  IRevenueCatRequestMap,
  IRevenueCatResultMap,
} from '@onekeyhq/shared/types/prime/revenueCat';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiInAppPurchase {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  async revenueCatIsAvailable(): Promise<boolean> {
    const client = await globalThis.$desktopMainAppFunctions?.getRevenueCat?.();
    return client?.isAvailable() ?? false;
  }

  private async _callRevenueCat<K extends IRevenueCatMethod>(
    method: K,
    params: IRevenueCatRequestMap[K],
  ): Promise<IRevenueCatResultMap[K]> {
    const client = await globalThis.$desktopMainAppFunctions?.getRevenueCat?.();
    if (!client)
      throw new OneKeyLocalError(
        'RevenueCat is unavailable in this desktop app version',
      );
    return client.invoke(method, params);
  }

  async revenueCatConfigure(params: IRevenueCatRequestMap['configure']) {
    return this._callRevenueCat('configure', params);
  }

  async revenueCatLogIn(params: IRevenueCatRequestMap['logIn']) {
    return this._callRevenueCat('logIn', params);
  }

  async revenueCatLogOut() {
    return this._callRevenueCat('logOut', undefined);
  }

  async revenueCatGetAppUserId() {
    return this._callRevenueCat('getAppUserId', undefined);
  }

  async revenueCatGetCustomerInfo(
    params: IRevenueCatRequestMap['getCustomerInfo'],
  ) {
    return this._callRevenueCat('getCustomerInfo', params);
  }

  async revenueCatGetOfferings() {
    return this._callRevenueCat('getOfferings', undefined);
  }

  async revenueCatPurchasePackage(
    params: IRevenueCatRequestMap['purchasePackage'],
  ) {
    return this._callRevenueCat('purchasePackage', params);
  }

  async revenueCatRestorePurchases(
    params: IRevenueCatRequestMap['restorePurchases'],
  ) {
    return this._callRevenueCat('restorePurchases', params);
  }

  async revenueCatCheckTrialOrIntroductoryPriceEligibility(
    params: IRevenueCatRequestMap['checkTrialOrIntroductoryPriceEligibility'],
  ) {
    return this._callRevenueCat(
      'checkTrialOrIntroductoryPriceEligibility',
      params,
    );
  }

  async revenueCatSetAttributes(
    params: IRevenueCatRequestMap['setAttributes'],
  ) {
    return this._callRevenueCat('setAttributes', params);
  }

  async testDelay() {
    const delay = 3651;
    await timerUtils.wait(delay);
    return `testDelay: ${delay}`;
  }

  async testError() {
    throw new OneKeyLocalError(`testError: ${Date.now()}`);
  }

  async getProducts(
    params: IDesktopIAPGetProductsParams,
  ): Promise<IDesktopIAPGetProductsResult> {
    if (process.platform === 'darwin') {
      const canMakePayments = inAppPurchase.canMakePayments();
      const products: Electron.Product[] = await inAppPurchase.getProducts(
        params.productIDs,
      );
      // get app bundleId
      const bundleId = getMacAppId();

      const result: IDesktopIAPGetProductsResult = {
        bundleId,
        canMakePayments,
        products,
        productIDs: params.productIDs,
      };

      return result;
    }

    const result: IDesktopIAPGetProductsResult = {
      bundleId: '',
      canMakePayments: false,
      products: [],
      productIDs: [],
    };
    return result;
  }

  async canMakePayments(): Promise<boolean> {
    if (process.platform === 'darwin') {
      return inAppPurchase.canMakePayments();
    }
    return false;
  }
}

export default DesktopApiInAppPurchase;
