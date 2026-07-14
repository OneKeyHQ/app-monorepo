import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const signPayloadTransactionSoftware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.signPayloadTransactionSoftware(
    ...args,
  );

const signPayloadTransactionHardware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.signPayloadTransactionHardware(
    ...args,
  );

const buildUnsignedTxForHardware = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.buildUnsignedTxForHardware(...args);

const deserializeFromSafeJSON = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.deserializeFromSafeJSON(...args);

const submitPayloadTransactionViaRpc = async (...args: any[]) =>
  appGlobals.$webembedApiProxy.chainKaspa.submitPayloadTransactionViaRpc(
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
