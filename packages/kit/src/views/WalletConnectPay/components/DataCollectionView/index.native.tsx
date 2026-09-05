import { useMemo, useRef, useState } from 'react';

import { WebView } from 'react-native-webview';

import { Spinner, Stack } from '@onekeyhq/components';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { isWcPayTrustedUrl } from '@onekeyhq/shared/src/walletConnect/payConstant';

import type { IDataCollectionViewProps } from './types';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

// Wraps the main frame's ReactNativeWebView.postMessage so every message it
// sends carries a per-mount secret nonce. Injection is main-frame-only (the
// react-native-webview default), so third-party iframes never learn the
// nonce even though the bridge object itself may be visible to them: on
// Android WebViews without WEB_MESSAGE_LISTENER the bridge falls back to
// addJavascriptInterface (exposed to every frame) and nativeEvent.url is the
// top-level URL, so a URL check alone cannot exclude iframe senders.
function buildBridgeNonceWrapperScript(nonce: string): string {
  return `
(function () {
  var NONCE = ${JSON.stringify(nonce)};
  var attempts = 0;
  function wrap() {
    attempts += 1;
    var bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== 'function') {
      return false;
    }
    if (bridge.__wcPayWrapped) {
      return true;
    }
    var origPostMessage = bridge.postMessage.bind(bridge);
    var wrappedPostMessage = function (data) {
      origPostMessage(JSON.stringify({ __wcPayNonce: NONCE, payload: data }));
    };
    try {
      bridge.postMessage = wrappedPostMessage;
    } catch (e) {
      // some bridge objects refuse property writes; fall through
    }
    if (window.ReactNativeWebView.postMessage !== wrappedPostMessage) {
      window.ReactNativeWebView = { postMessage: wrappedPostMessage };
    }
    window.ReactNativeWebView.__wcPayWrapped = true;
    return true;
  }
  if (!wrap()) {
    var timer = setInterval(function () {
      if (wrap() || attempts > 200) {
        clearInterval(timer);
      }
    }, 50);
  }
})();
true;
`;
}

/**
 * Native variant: the hosted compliance form runs in a WebView and reports
 * completion through the ReactNativeWebView message bridge.
 */
export function DataCollectionView({
  url,
  onComplete,
  onError,
}: IDataCollectionViewProps) {
  const completedRef = useRef(false);
  // the hosted form can take seconds to load; keep a spinner over the empty
  // webview so the page never looks blank/frozen
  const [isFormLoaded, setIsFormLoaded] = useState(false);
  // fresh secret per form instance; proves a message went through the
  // main-frame wrapper injected below
  const [bridgeNonce] = useState(() => stringUtils.generateUUID());
  const bridgeNonceWrapperScript = useMemo(
    () => buildBridgeNonceWrapperScript(bridgeNonce),
    [bridgeNonce],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    // defense-in-depth on platforms that report per-frame URLs; the real
    // frame-origin guarantee is the nonce check below
    if (!isWcPayTrustedUrl(event.nativeEvent.url ?? '')) {
      return;
    }
    try {
      const envelope = JSON.parse(event.nativeEvent.data) as {
        __wcPayNonce?: string;
        payload?: unknown;
      };
      // only accept messages sent through the main-frame postMessage
      // wrapper; iframes can reach the bridge but never learn the nonce
      if (envelope?.__wcPayNonce !== bridgeNonce) {
        return;
      }
      const data = (
        typeof envelope.payload === 'string'
          ? JSON.parse(envelope.payload)
          : envelope.payload
      ) as {
        type?: string;
        error?: string;
      };
      if (data?.type === 'IC_COMPLETE' && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      } else if (data?.type === 'IC_ERROR' && !completedRef.current) {
        completedRef.current = true;
        onError(String(data?.error ?? 'Data collection failed'));
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <Stack flex={1}>
      <WebView
        source={{ uri: url }}
        onMessage={handleMessage}
        javaScriptEnabled
        // the hosted form requires DOM storage; Android defaults it to off
        domStorageEnabled
        // install the nonce wrapper as early as possible and again after
        // load (idempotent) in case the pre-load injection did not run
        injectedJavaScriptBeforeContentLoaded={bridgeNonceWrapperScript}
        injectedJavaScript={bridgeNonceWrapperScript}
        // keep top-frame navigation inside the trusted WalletConnect Pay
        // host; iOS also reports loads of embedded frames here, which the
        // page's own CSP (frame-src) governs, so let those through. Only an
        // explicit isTopFrame === false may skip the check: Android's
        // shouldOverrideUrlLoading events omit isTopFrame entirely, so
        // undefined must be validated as a top-frame navigation
        onShouldStartLoadWithRequest={(request: ShouldStartLoadRequest) =>
          request.isTopFrame === false || isWcPayTrustedUrl(request.url)
        }
        onLoadEnd={() => setIsFormLoaded(true)}
      />
      {!isFormLoaded ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          bg="$bgApp"
          pointerEvents="none"
        >
          <Spinner size="large" />
        </Stack>
      ) : null}
    </Stack>
  );
}
