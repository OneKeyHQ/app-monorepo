import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const buildCommitTxInfo = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.buildCommitTxInfo(...args);

const createKRC20RevealTxJSON = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.createKRC20RevealTxJSON(...args);

const signRevealTransactionSoftware = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.signRevealTransactionSoftware(
    ...args,
  );

const signRevealTransactionHardware = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.signRevealTransactionHardware(
    ...args,
  );

const buildUnsignedTxForHardware = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.buildUnsignedTxForHardware(
    ...args,
  );

const deserializeFromSafeJSON = async (...args: any[]) =>
  ensureWebembedApiProxyAvailable().chainKaspa.deserializeFromSafeJSON(...args);

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
