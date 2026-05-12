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

const hasSetTagWithBody = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.adaSdk.hasSetTagWithBody(...args);

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

const parseRawTxInputs = async (rawTxHex: string) =>
  appGlobals.$offscreenApiProxy.adaSdk.parseRawTxInputs(rawTxHex);

const parseRawTxBodyStakeInfo = async (rawTxHex: string) =>
  appGlobals.$offscreenApiProxy.adaSdk.parseRawTxBodyStakeInfo(rawTxHex);

const extractStakeKeyHashFromBaseAddress = async (addr: string) =>
  appGlobals.$offscreenApiProxy.adaSdk.extractStakeKeyHashFromBaseAddress(addr);

const getCardanoApi: IGetCardanoApi = async () =>
  Promise.resolve({
    composeTxPlan,
    signTransaction,
    hwSignTransaction,
    txToOneKey,
    hasSetTagWithBody,
    dAppGetBalance,
    dAppGetAddresses,
    dAppGetUtxos,
    dAppConvertCborTxToEncodeTx,
    dAppSignData,
    parseRawTxInputs,
    parseRawTxBodyStakeInfo,
    extractStakeKeyHashFromBaseAddress,
  });

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
