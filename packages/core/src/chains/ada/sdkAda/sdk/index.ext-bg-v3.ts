import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IAdaSdk, IEnsureSDKReady, IGetCardanoApi } from './types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const composeTxPlan = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.composeTxPlan(...args);

const signTransaction = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.signTransaction(...args);

const hwSignTransaction = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.hwSignTransaction(...args);

const txToOneKey = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.txToOneKey(...args);

const dAppGetBalance = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.dAppGetBalance(...args);

const dAppGetAddresses = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.dAppGetAddresses(...args);

const dAppGetUtxos = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.dAppGetUtxos(...args);

const dAppConvertCborTxToEncodeTx = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.dAppConvertCborTxToEncodeTx(...args);

const dAppSignData = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.dAppSignData(...args);

const getCardanoApi: IGetCardanoApi = async () =>
  Promise.resolve({
    composeTxPlan,
    signTransaction,
    hwSignTransaction,
    txToOneKey,
    dAppGetBalance,
    dAppGetAddresses,
    dAppGetUtxos,
    dAppConvertCborTxToEncodeTx,
    dAppSignData,
  });

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
