/* eslint-disable @typescript-eslint/no-unsafe-return */
import offscreenApiProxy from '@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy';

import type { IAdaSdk, IEnsureSDKReady, IGetCardanoApi } from './types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const composeTxPlan = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.composeTxPlan(...args);

const signTransaction = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.signTransaction(...args);

const hwSignTransaction = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.hwSignTransaction(...args);

const txToOneKey = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.txToOneKey(...args);

const dAppGetBalance = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.dAppGetBalance(...args);

const dAppGetAddresses = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.dAppGetAddresses(...args);

const dAppGetUtxos = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.dAppGetUtxos(...args);

const dAppConvertCborTxToEncodeTx = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.dAppConvertCborTxToEncodeTx(...args);

const dAppSignData = async (...args: any[]) =>
  offscreenApiProxy.adaSdk.dAppSignData(...args);

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
