import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const buildCommitTxInfo = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.buildCommitTxInfo(...args);

const createKRC20RevealTxJSON = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.createKRC20RevealTxJSON(...args);

const signRevealTransactionSoftware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.signRevealTransactionSoftware(...args);

const signRevealTransactionHardware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.signRevealTransactionHardware(...args);

const buildUnsignedTxForHardware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.buildUnsignedTxForHardware(...args);

const deserializeFromSafeJSON = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.deserializeFromSafeJSON(...args);

const getKaspaApi: IGetKaspaApi = async () =>
  Promise.resolve({
    buildCommitTxInfo,
    createKRC20RevealTxJSON,
    signRevealTransactionSoftware,
    signRevealTransactionHardware,
    buildUnsignedTxForHardware,
    deserializeFromSafeJSON,
  });

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
