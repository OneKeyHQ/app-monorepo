import { inAppPurchase } from 'electron';

import type { IDesktopSubModuleInitParams } from '@onekeyhq/shared/types/desktop';

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
  const products = await inAppPurchase.getProducts(productIDs);
  console.log('inAppPurchase___products', products);
  console.log('inAppPurchase___products.length', products.length);
}

function init(_initParams: IDesktopSubModuleInitParams) {
  setTimeout(() => {
    void testIAP();
  }, 5000);

  // ipcMain.on(
  //   ipcMessageKeys.APP_DEV_ONLY_API,
  //   (event, apiParams: IDesktopMainProcessDevOnlyApiParams) => {
  //     if (process.env.NODE_ENV !== 'production') {
  //       const { module, method, params } = apiParams;
  //       console.log('call APP_DEV_ONLY_API::', module, method, params);
  //       if (module === 'shell') {
  //         // @ts-ignore
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  //         shell[method](...params);
  //       }
  //     }
  //   },
  // );
}

export default {
  init,
};
