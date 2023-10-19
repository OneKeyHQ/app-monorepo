export const allowedDomains = [
  'localhost',
  '127.0.0.1',
  'api.github.com',
  'o554666.ingest.sentry.io',
  'onekey.so',
  'swap.onekey.so',
  'portfolio.onekey.so',
  'discover.onekey.so',
  '243096.com',
  'onekey-asset.com',
];

export const cspRules = [
  // Default to only own resources
  "default-src 'self' 'unsafe-inline' onekey.243096.com dev.243096.com onekey-asset.com",
  // Allow all API calls (Can't be restricted bc of custom backends)
  'connect-src *',
  // Allow images from trezor.io
  "img-src 'self' onekey.243096.com devs.243096.com onekey.so *.onekey.so onekey-asset.com",
];
