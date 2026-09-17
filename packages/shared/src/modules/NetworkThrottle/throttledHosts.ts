// The weak-network dev setting simulates a slow connection for OneKey's own
// traffic only: the API endpoints (prod and test hosts, including the
// notification socket in both websocket and polling transports) and the asset
// CDNs that serve token and market images.
//
// Everything else keeps full speed — DApp pages, third-party RPC and price
// feeds, and the local development server — so the setting never slows down
// work unrelated to the scenario being tested.
//
// A `*.` prefix matches sub-domains at any depth but not the bare apex, which
// is correct here because every OneKey endpoint is a sub-domain.
export const NETWORK_THROTTLE_ONEKEY_HOSTS = [
  '*.onekeycn.com',
  '*.onekeytest.com',
  '*.onekey-asset.com',
  'app-assets.onekey.so',
] as const;
