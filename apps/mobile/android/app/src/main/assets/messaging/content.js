/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable no-undef */
/* eslint-disable no-eval */
console.log(`content:start`);
const callbackMap = new Map();
let callbackId = 0;
const initWebembedReceiveHandler = (times = 0) => {
  if (!globalThis.$onekey && times < 5000) {
    setTimeout(() => {
      initWebembedReceiveHandler(times + 1);
    }, 50);
    return;
  }
  globalThis.$onekey.$private.webembedReceiveHandler = (payload) => {
    return new Promise((resolve, reject) => {
      callbackMap.set(callbackId, { resolve, reject });
      callbackId += 1;
      console.log('webembedReceiveHandler', payload);
      const event = new CustomEvent('webembedReceiveHandler', {
        detail: {
          data: cloneInto(payload, window),
          callbackId,
        },
      });
      window.dispatchEvent(event);
    });
  };
};
initWebembedReceiveHandler();

const webEmbed = {
  callWebEmbedApiMethod: (callbackId, error, response) => {
    const callback = callbackMap.get(callbackId);
    if (error) {
      callback.reject(error);
    } else {
      callback.resolve(response);
    }
    callbackMap.delete(callbackId);
  },
};
window.wrappedJSObject.$webEmbed = cloneInto(webEmbed, window, {
  cloneFunctions: true,
});

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
