import type { IAdaSdk, IEnsureSDKReady } from './types';

const getCardanoApi = async () =>
  Promise.resolve(global.$webembedApiProxy.chainAdaLegacy);

// auto check webembedApi ready by calling each method
const ensureSDKReady: IEnsureSDKReady = async () => global.$webembedApiProxy.isSDKReady();

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
