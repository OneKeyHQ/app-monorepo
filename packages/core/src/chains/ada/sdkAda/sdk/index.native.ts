/* eslint-disable @typescript-eslint/no-unused-vars */
// import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';

import type { IAdaSdk, IEnsureSDKReady, IGetCardanoApi } from './types';

const webembedApiProxy = {
  chainAdaLegacy: {
    composeTxPlan(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    signTransaction(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    hwSignTransaction(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    txToOneKey(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    dAppGetBalance(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    dAppGetAddresses(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    dAppGetUtxos(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    dAppConvertCborTxToEncodeTx(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
    dAppSignData(...args: any[]) {
      throw new Error('webembedApiProxy in core not implemented');
    },
  },
};

const getCardanoApi: IGetCardanoApi = async () =>
  Promise.resolve(webembedApiProxy.chainAdaLegacy);

// auto check webembedApi ready by calling each method
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
