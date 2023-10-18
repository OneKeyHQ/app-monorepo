import adaWebSdk from './adaWebSdk';

import type { IAdaSdk, IEnsureSDKReady } from './types';

const { getCardanoApi } = adaWebSdk;

/**
 * Web SDK is always successful
 */
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
