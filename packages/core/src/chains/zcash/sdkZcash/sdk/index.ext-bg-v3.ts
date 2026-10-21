import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { createZcashSdkProxy } from './createSdkProxy';

import type { IEnsureSDKReady, IGetZcashApi, IZcashSdk } from '../types/sdk';

// Extension MV3: bg forwards to the offscreen document, which creates the
// same dedicated wallet Worker used by every other carrier.
// The runtime is single-threaded and does not need crossOriginIsolated.
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const api = createZcashSdkProxy(() => appGlobals.$offscreenApiProxy.zcashSdk);

const getZcashApi: IGetZcashApi = async () => Promise.resolve(api);

const sdk: IZcashSdk = { getZcashApi, ensureSDKReady };
export default sdk;
