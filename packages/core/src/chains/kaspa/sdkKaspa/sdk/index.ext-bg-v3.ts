import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const signPayloadTransactionSoftware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.signPayloadTransactionSoftware(
    ...args,
  );

const signPayloadTransactionHardware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.signPayloadTransactionHardware(
    ...args,
  );

const buildUnsignedTxForHardware = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.buildUnsignedTxForHardware(...args);

const deserializeFromSafeJSON = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.deserializeFromSafeJSON(...args);

const submitPayloadTransactionViaRpc = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.submitPayloadTransactionViaRpc(
    ...args,
  );

const getKaspaApi: IGetKaspaApi = async () =>
  Promise.resolve({
    signPayloadTransactionSoftware,
    signPayloadTransactionHardware,
    buildUnsignedTxForHardware,
    deserializeFromSafeJSON,
    submitPayloadTransactionViaRpc,
  });

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
