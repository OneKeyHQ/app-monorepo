import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const buildCommitTxInfo = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.buildCommitTxInfo(...args);

const createKRC20RevealTxJSON = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.createKRC20RevealTxJSON(...args);

const signRevealTransactionSoftware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.signRevealTransactionSoftware(
    ...args,
  );

const signRevealTransactionHardware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.signRevealTransactionHardware(
    ...args,
  );

const buildUnsignedTxForHardware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.buildUnsignedTxForHardware(...args);

const deserializeFromSafeJSON = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.deserializeFromSafeJSON(...args);

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
