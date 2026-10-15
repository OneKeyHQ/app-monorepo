import { ensureWebembedApiProxyAvailable } from '@onekeyhq/shared/src/utils/assertUtils';

import { createZcashSdkProxy } from './createSdkProxy';

import type { IEnsureSDKReady, IGetZcashApi, IZcashSdk } from '../types/sdk';

// iOS/Android: the background is Hermes and cannot run wasm, so calls go to the
// web-embed WebView, which hosts the same implementation as every other carrier.
//
// The single-threaded runtime scans inside the WebView without requiring
// crossOriginIsolated or a thread pool.
//
// The remaining mobile constraint is the origin, not the capability: under
// file:// the WebView refuses to import ES modules at all, so the web-embed has
// to be served from a virtual https origin for this to work.
const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const api = createZcashSdkProxy(
  () => ensureWebembedApiProxyAvailable().chainZcash,
);

const getZcashApi: IGetZcashApi = async () => Promise.resolve(api);

const sdk: IZcashSdk = { getZcashApi, ensureSDKReady };
export default sdk;
