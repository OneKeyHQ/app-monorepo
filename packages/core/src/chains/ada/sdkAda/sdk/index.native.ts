/* eslint-disable @typescript-eslint/no-unused-vars */
import webembedApiProxy from '@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy';

import type { IAdaSdk, IAdaSdkApi, IEnsureSDKReady, IGetCardanoApi } from './types';

const module = new Proxy({}, {
  get: function (target, method: string) {
    return function(...params: any[]) {
      return webembedApiProxy.callRemoteApi({
        module: 'chainAdaLegacy',
        method,
        params,
      });
    }
  }
}) as IAdaSdkApi;

const getCardanoApi: IGetCardanoApi = async () =>
  Promise.resolve(module);

// auto check webembedApi ready by calling each method
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
