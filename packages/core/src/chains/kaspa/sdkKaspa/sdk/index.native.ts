import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IKaspaSdk } from '../types';

const getKaspaApi = async () =>
  Promise.resolve(appGlobals.$webembedApiProxy.chainKaspa);

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
