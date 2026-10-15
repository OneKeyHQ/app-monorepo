import appGlobals from '@onekeyhq/shared/src/appGlobals';

import { createZcashSdkProxy } from './createSdkProxy';

import type { IEnsureSDKReady, IGetZcashApi, IZcashSdk } from '../types/sdk';

// Extension MV3: bg forwards to the offscreen document, which creates the
// same dedicated wallet Worker used by every other carrier.
//
// The offscreen document no longer needs COOP/COEP for Zcash's sake: this
// runtime is single-threaded and does not use crossOriginIsolated. Check for
// other dependents before removing those manifest keys.
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const api = createZcashSdkProxy(() => appGlobals.$offscreenApiProxy.zcashSdk);

const getZcashApi: IGetZcashApi = async () => Promise.resolve(api);

const sdk: IZcashSdk = { getZcashApi, ensureSDKReady };
export default sdk;
