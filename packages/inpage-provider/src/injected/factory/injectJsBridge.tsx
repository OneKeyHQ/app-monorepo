/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import JsBridgeBase from '../../jsBridge/JsBridgeBase';

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
function injectJsBridge(bridge: JsBridgeBase): void {
  fixGlobalShim();

  if (!window?.$onekey?.jsBridge) {
    window.$onekey = window.$onekey || {};
    window.$onekey.jsBridge = bridge;
  }

  console.log(
    '===== OneKey jsBridge injected success! 897 >>>>> ',
    performance.now(),
  );
}

export default injectJsBridge;
