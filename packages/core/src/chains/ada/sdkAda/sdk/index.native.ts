import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import type { IAdaSdk, IEnsureSDKReady } from './types';

const getCardanoApi = async () =>
  Promise.resolve(ensureWebembedApiProxyAvailable().chainAdaLegacy);

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const sdk: IAdaSdk = { getCardanoApi, ensureSDKReady };
export default sdk;
