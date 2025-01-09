const isDev = process.env.NODE_ENV !== 'production';
const isManifestV3 = !!process.env.EXT_MANIFEST_V3;
// for react-render-tracker.js
const devCSP = [
  "'unsafe-eval'",
  "'unsafe-inline'",
  "'sha256-okLL2yROU0HMWSGpD14oLvTZgL1goXE2KubzYT+yRKA='",
  'http://localhost:3100',
].join(' ');

module.exports = {
  'content_security_policy': `
    script-src 'self' 'wasm-unsafe-eval' ${
      isDev && !isManifestV3 ? devCSP : ''
    }  ;
    object-src 'self';
    `
    .split('\n')
    .filter(Boolean)
    .join(''),
};
