// Web and the Desktop renderer run the SDK where kit-bg runs. The extension's
// offscreen document imports ./breezSdkWeb directly, because extension pages
// resolve ./breezSdk to the stub in breezSdk.ext.ts.
export { loadBreezSdk } from './breezSdkWeb';
