import kaspaWebSdk from './kaspaWebSdk';

import type { IEnsureSDKReady, IKaspaSdk } from '../types';

const { getKaspaApi } = kaspaWebSdk;

/**
 * Web SDK is always successful
 */
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
