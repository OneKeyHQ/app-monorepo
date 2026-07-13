/* eslint-disable */
/**
 * Lightweight preload for first-party TradingView chart WebViews.
 *
 * This file intentionally does not inject wallet providers, floating dapp UI,
 * clipboard overrides, or discovery/dapp features. It only provides the chart
 * transport bridge required by the chart page.
 */
(function () {
  var electron = require('electron');
  var contextBridge = electron.contextBridge;
  var ipcRenderer = electron.ipcRenderer;
  var webFrame = electron.webFrame;

  var HOST_CHANNEL = 'JsBridgeDesktopHostToInjected';
  var INPAGE_TO_HOST_CHANNEL = 'onekey@JS_BRIDGE_MESSAGE_IPC_CHANNEL';

  contextBridge.exposeInMainWorld('__onekeyDesktopChartBridge', {
    sendToHost: function (data) {
      ipcRenderer.sendToHost(INPAGE_TO_HOST_CHANNEL, data);
    },
    onHostMessage: function (callback) {
      ipcRenderer.on(HOST_CHANNEL, function (_event, data) {
        callback(data);
      });
    },
  });

  var injectedChartBridge = function () {
    if (window.__onekeyChartBridge) {
      return;
    }
    window.__onekeyChartBridge = true;

    function getOrigin() {
      try {
        var loc = window.location;
        if (loc.origin && loc.origin !== 'null') {
          return loc.origin;
        }
        if (loc.protocol && loc.host) {
          return loc.protocol + '//' + loc.host;
        }
      } catch (e) {
        // noop
      }
      return '';
    }

    function normalizeMessage(message) {
      if (typeof message !== 'string') {
        return message;
      }
      try {
        return JSON.parse(message);
      } catch (e) {
        return message;
      }
    }

    function forward(message) {
      try {
        var chartMessage = normalizeMessage(message);
        var payload = {
          origin: getOrigin(),
          data: chartMessage,
        };
        if (chartMessage && typeof chartMessage === 'object') {
          if (chartMessage.scope) {
            payload.scope = chartMessage.scope;
          }
          if (chartMessage.method) {
            payload.method = chartMessage.method;
          }
          if (chartMessage.requestId) {
            payload.requestId = chartMessage.requestId;
          }
        }
        window.__onekeyDesktopChartBridge.sendToHost(JSON.stringify(payload));
      } catch (e) {
        // noop
      }
    }

    window.__chartNativePost = function (payloadString) {
      forward(payloadString);
    };

    window.$onekey = window.$onekey || {};
    window.$onekey.$private = window.$onekey.$private || {};
    window.$onekey.$private.request = function (payload) {
      forward(payload);
    };

    window.ReactNativeWebView = window.ReactNativeWebView || {};
    window.ReactNativeWebView.postMessage = function (payload) {
      forward(payload);
    };

    window.addEventListener('message', function (event) {
      try {
        if (!event || event.source !== window) {
          return;
        }
        var currentOrigin = getOrigin();
        if (
          event.origin &&
          event.origin !== 'null' &&
          currentOrigin &&
          event.origin !== currentOrigin
        ) {
          return;
        }
        var data = event && event.data;
        if (data && data.scope === '$private') {
          forward(data);
        }
      } catch (e) {
        // noop
      }
    });

    try {
      window.__onekeyDesktopChartBridge.onHostMessage(function (data) {
        window.postMessage(data, '*');
      });
    } catch (e) {
      // noop
    }

    forward({
      scope: '$private',
      method: 'onekey_chartBridgeReady',
      data: {
        version: 1,
        href: String((window.location && window.location.href) || ''),
      },
    });
  };

  webFrame.executeJavaScript('(' + injectedChartBridge.toString() + ')();');
})();
