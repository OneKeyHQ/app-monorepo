// global is not defined
// https://github.com/mrousavy/react-native-mmkv/issues/794
// eslint-disable-next-line no-undef
if (typeof globalThis.global === 'undefined') {
  // eslint-disable-next-line no-undef
  globalThis.global = globalThis;
}
