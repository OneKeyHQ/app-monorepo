// Canonical Chromium extension IDs/origins and browser extension store listings.
// Deployment CSP and app-webview-pages/captcha bridge allowlists select
// their permitted origins separately; updating this registry does not deploy them.
export const EXTENSION_IDS = {
  // Chrome Web Store production release.
  chrome: 'jnmbobjmhlngoefaiojfljckilhhlhcj',
  // Microsoft Edge Add-ons production release.
  edge: 'obffkkagpmohennipjokmpllocnlndac',
  // Chrome Web Store development release.
  chromeDevelopment: 'dbdljbcdpcfbehjpkbpdchmoiblamjjo',
  // Unpacked build, determined by the key in apps/ext/src/manifest/shared.js.
  localDevelopment: 'goodgebcoklfekldbhjmckehehjdfipe',
} as const;

export const EXTENSION_ORIGINS = {
  chrome: `chrome-extension://${EXTENSION_IDS.chrome}`,
  edge: `chrome-extension://${EXTENSION_IDS.edge}`,
  chromeDevelopment: `chrome-extension://${EXTENSION_IDS.chromeDevelopment}`,
  localDevelopment: `chrome-extension://${EXTENSION_IDS.localDevelopment}`,
} as const satisfies Record<
  keyof typeof EXTENSION_IDS,
  `chrome-extension://${string}`
>;

export const EXTENSION_STORE_URLS = {
  chrome: `https://chrome.google.com/webstore/detail/onekey/${EXTENSION_IDS.chrome}`,
  edge: `https://microsoftedge.microsoft.com/addons/detail/onekey/${EXTENSION_IDS.edge}`,
  chromeDevelopment: `https://chromewebstore.google.com/detail/onekey-secure-crypto-wall/${EXTENSION_IDS.chromeDevelopment}?hl=en-GB&utm_source=ext_sidebar`,
  firefox: 'https://addons.mozilla.org/zh-CN/firefox/addon/onekey/reviews/',
} as const;
