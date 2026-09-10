import sdk from './index.web';

// Node/Jest fallback. Real platform resolution picks index.web.ts (web),
// index.desktop.ts (desktop),
// index.ext-bg-v3.ts (extension MV3 bg), or index.native.ts (iOS/Android) via
// the rspack/metro suffix resolver.
export default sdk;
