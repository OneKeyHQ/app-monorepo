import { IJsBridge } from '../../types';

function fixGlobalShim() {
  // FIX errors in ReactNative
  //    ReferenceError: Can't find variable: global
  // @ts-ignore
  window.global = window.global || window || window.globalThis;

  // eslint-disable-next-line global-require
  require('globalthis');

  // @ts-ignore
  window.global = window.global || window || window.globalThis;
}

// TODO injectWindowJsBridge
function injectJsBridge({
  createBridge,
}: {
  createBridge: () => IJsBridge;
}): void {
  fixGlobalShim();

  if (!window?.onekey?.jsBridge) {
    window.onekey = window.onekey || {};
    window.onekey.jsBridge = createBridge();
  }

  console.log('OneKey jsBridge injected success! 8888');
}

export default injectJsBridge;
