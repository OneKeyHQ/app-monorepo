import { inAppPurchase, ipcMain } from 'electron';

import type { IDesktopSubModuleInitParams } from '@onekeyhq/shared/types/desktop';

import { ipcMessageKeys } from './config';

import type {
  IDesktopIAPGetProductsParams,
  IDesktopIAPGetProductsResult,
} from './config';

async function testIAP() {
  const canMakePayments = inAppPurchase.canMakePayments();
  console.log('inAppPurchase___canMakePayments', canMakePayments);

  // node_modules/electron/dist/Electron.app/Contents/Info.plist
  // <key>CFBundleIdentifier</key>
  // <string>so.onekey.wallet</string>
  const productIDs: string[] = [
    'Prime_Yearly',
    'Prime_Monthly',
    'so.onekey.wallet.Prime_Yearly',
    'so.onekey.wallet.Prime_Monthly',
  ];
  const products: Electron.Product[] = await inAppPurchase.getProducts(
    productIDs,
  );
  console.log('inAppPurchase___products', products);
  console.log('inAppPurchase___products.length', products.length);
}

function init(_initParams: IDesktopSubModuleInitParams) {
  ipcMain.on(
    ipcMessageKeys.IAP_GET_PRODUCTS,
    async (event, apiParams: IDesktopIAPGetProductsParams) => {
      if (process.env.NODE_ENV !== 'production') {
        void testIAP();
      }
      if (process.platform === 'darwin') {
        const canMakePayments = inAppPurchase.canMakePayments();
        const products: Electron.Product[] = await inAppPurchase.getProducts(
          apiParams.productIDs,
        );
        const result: IDesktopIAPGetProductsResult = {
          canMakePayments,
          products,
        };
        return event.reply(ipcMessageKeys.IAP_GET_PRODUCTS, result);
      }

      const result: IDesktopIAPGetProductsResult = {
        canMakePayments: false,
        products: [],
      };
      return event.reply(ipcMessageKeys.IAP_GET_PRODUCTS, result);
    },
  );
}

export default {
  init,
};
