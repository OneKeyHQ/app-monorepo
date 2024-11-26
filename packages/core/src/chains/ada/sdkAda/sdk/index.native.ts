import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IAdaSdk, IEnsureSDKReady } from './types';

const getCardanoApi = async () =>
  Promise.resolve(appGlobals.$webembedApiProxy.chainAdaLegacy);

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
