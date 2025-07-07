import { inAppPurchase } from 'electron';

import type {
  IDesktopIAPGetProductsParams,
  IDesktopIAPGetProductsResult,
} from '@onekeyhq/desktop/app/config';
import { getMacAppId } from '@onekeyhq/desktop/app/libs/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiInAppPurchase {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

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
