import type { IAdaSdk, IEnsureSDKReady, IGetCardanoApi } from './types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const composeTxPlan = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.composeTxPlan(...args);

const signTransaction = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.signTransaction(...args);

const hwSignTransaction = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.hwSignTransaction(...args);

const txToOneKey = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.txToOneKey(...args);

const dAppGetBalance = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.dAppGetBalance(...args);

const dAppGetAddresses = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.dAppGetAddresses(...args);

const dAppGetUtxos = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.dAppGetUtxos(...args);

const dAppConvertCborTxToEncodeTx = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.dAppConvertCborTxToEncodeTx(...args);

const dAppSignData = async (...args: any[]) =>
  globalThis.$offscreenApiProxy.adaSdk.dAppSignData(...args);

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
