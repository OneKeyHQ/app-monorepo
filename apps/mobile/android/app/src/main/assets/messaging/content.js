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
// eslint-disable-next-line no-undef
globalThis.wrappedJSObject.ReactNativeWebView = cloneInto(
  ReactNativeWebView,
  globalThis,
  {
    cloneFunctions: true,
  },
);

browser.runtime.onMessage.addListener((data, sender) => {
  if (data.inject) {
    try {
      globalThis.eval(data.inject);
    } catch (e) {
      return Promise.resolve();
    }
    return Promise.resolve();
  }
  let event;
  try {
    // eslint-disable-next-line no-undef
    event = new MessageEvent('message', data);
  } catch (e) {
    event = document.createEvent('MessageEvent');
    event.initMessageEvent(
      'message',
      true,
      true,
      data.data,
      data.origin,
      data.lastEventId,
      data.source,
    );
  }
  document.dispatchEvent(event);
});
