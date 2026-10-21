import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import { createZcashSdkProxy } from './createSdkProxy';

import type { IEnsureSDKReady, IGetZcashApi, IZcashSdk } from '../types/sdk';

// iOS/Android: Hermes cannot run wasm, so calls go to the web-embed WebView,
// which hosts the same single-threaded implementation as every other carrier.
// The web-embed must be served from a virtual https origin: under file:// the
// WebView refuses to import ES modules.
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const api = createZcashSdkProxy(
  () => ensureWebembedApiProxyAvailable().chainZcash,
);

const getZcashApi: IGetZcashApi = async () => Promise.resolve(api);

const sdk: IZcashSdk = { getZcashApi, ensureSDKReady };
export default sdk;
