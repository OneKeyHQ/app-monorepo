/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable no-undef */
/* eslint-disable no-eval */
console.log(`content:start`);
const ReactNativeWebView = {
  postMessage(message) {
    browser.runtime.sendMessage({
      action: 'ReactNativeWebView',
      data: message,
    });
  },
};

window.wrappedJSObject.ReactNativeWebView = cloneInto(
  ReactNativeWebView,
  window,
  {
    cloneFunctions: true,
  },
);

window.ReactNativeWebView = ReactNativeWebView;

const onekeyUtils = {
  $private: {
    request: (...args) => {
      return new window.Promise((resolve, reject) => {
        globalThis.$onekey.$private
          .request(...args)
          .then((result) => {
            resolve(cloneInto(result, window));
          })
          .catch((error) => {
            reject(cloneInto(error, window));
          });
      });
    },
  },
  jsBridge: {
    receive: (...args) => {
      globalThis.$onekey.jsBridge.receive(...args);
    },
  },
};
window.wrappedJSObject.$onekey = cloneInto(onekeyUtils, window, {
  cloneFunctions: true,
});

browser.runtime.onMessage.addListener((data, sender) => {
  if (data.inject) {
    try {
      globalThis.eval(data.inject);
    } catch (e) {
      return Promise.resolve();
    }
    return Promise.resolve();
  }
});
