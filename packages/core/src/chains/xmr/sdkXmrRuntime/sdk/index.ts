// Node/Jest fallback. Real platform resolution picks index.web.ts (web),
// index.desktop.ts (desktop), index.ext-bg-v3.ts (extension MV3 background),
// or index.native.ts (iOS/Android) through the rspack/metro suffix resolver.
export { getXmrRuntimeApiForCarrier } from './index.web';
