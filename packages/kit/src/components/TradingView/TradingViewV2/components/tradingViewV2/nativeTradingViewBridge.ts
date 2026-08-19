/**
 * TradingView only uses the private OneKey request channel. Injecting the full
 * multi-chain wallet provider into WKWebView adds roughly 2 MB of synchronous
 * document-start JavaScript before the chart app can bootstrap.
 */
export const TRADING_VIEW_NATIVE_MINIMAL_BRIDGE_SCRIPT = `
;(function () {
  var callbacks = Object.create(null);
  var nextRequestId = 1;

  function receive(message) {
    try {
      var payload = typeof message === 'string' ? JSON.parse(message) : message;
      if (!payload || payload.type !== 'RESPONSE' || payload.id == null) {
        return;
      }

      var callback = callbacks[payload.id];
      if (!callback) {
        return;
      }
      delete callbacks[payload.id];

      if (payload.error) {
        var error = new Error(payload.error.message || 'TradingView bridge request failed');
        if (payload.error.code !== undefined) {
          error.code = payload.error.code;
        }
        callback.reject(error);
        return;
      }
      callback.resolve(payload.data);
    } catch (_error) {
      // Ignore malformed host responses. Chart data responses use window messages.
    }
  }

  function request(data) {
    var requestId = nextRequestId++;
    return new Promise(function (resolve, reject) {
      var nativeBridge = window.ReactNativeWebView;
      if (!nativeBridge || typeof nativeBridge.postMessage !== 'function') {
        reject(new Error('TradingView native bridge is unavailable'));
        return;
      }

      callbacks[requestId] = { resolve: resolve, reject: reject };
      nativeBridge.postMessage(JSON.stringify({
        id: requestId,
        type: 'REQUEST',
        scope: '$private',
        origin: window.location.origin,
        data: data
      }));
    });
  }

  var oneKey = window.$onekey || {};
  oneKey.jsBridge = { receive: receive };
  oneKey.$private = { request: request };
  window.$onekey = oneKey;
})();
true;
`;
