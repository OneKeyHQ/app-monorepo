import type { ComponentProps } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { WebViewWithFeatures } from '@onekeyhq/kit/src/components/WebView/WebViewWithFeatures';
import { useWebviewPerpTradeTargetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HYPER_LIQUID_WEBVIEW_TRADE_URL,
  WEBVIEW_PERP_TRADE_TARGET_TTL_MS,
} from '@onekeyhq/shared/src/consts/perp';

type IWebviewPerpTradeWebViewProps = Pick<
  ComponentProps<typeof WebViewWithFeatures>,
  | 'onWebViewRef'
  | 'onDidStartLoading'
  | 'onDidStartNavigation'
  | 'onDidFinishLoad'
  | 'onDidStopLoading'
  | 'onDidFailLoad'
>;

export function WebviewPerpTradeWebView(props: IWebviewPerpTradeWebViewProps) {
  const [target] = useWebviewPerpTradeTargetAtom();
  const hasRenderedWebView = useRef(false);
  const initialRevision = useRef(target.revision);
  const [initialWaitExpired, setInitialWaitExpired] = useState(false);
  const waitingForInitialTarget =
    !hasRenderedWebView.current &&
    !initialWaitExpired &&
    target.revision === initialRevision.current &&
    Object.values(target.pendingRequests ?? {}).some(
      (pending) => pending.expiresAt > Date.now(),
    );
  useEffect(() => {
    if (!waitingForInitialTarget) return;
    // Bound this mount's wait even if BG is unavailable or other UIs keep
    // preparing new requests. Metadata updates must not restart the timer.
    const timeout = setTimeout(
      () => setInitialWaitExpired(true),
      WEBVIEW_PERP_TRADE_TARGET_TTL_MS,
    );
    return () => clearTimeout(timeout);
  }, [waitingForInitialTarget]);
  useLayoutEffect(() => {
    if (!waitingForInitialTarget) hasRenderedWebView.current = true;
  }, [waitingForInitialTarget]);
  // On a cold tab mount, wait for the accepted target rather than loading the
  // default page first. An existing WebView stays mounted during preparation.
  if (waitingForInitialTarget) return null;
  const url = new URL(HYPER_LIQUID_WEBVIEW_TRADE_URL);
  if (target.coin) {
    url.pathname = `/trade/${encodeURIComponent(target.coin)}`;
  }
  return (
    <WebViewWithFeatures
      {...props}
      // Re-selecting the same coin must override navigation within the dApp.
      key={target.revision}
      features={{ notifyChangedEventsToDappOnFocus: true }}
      id="perp-trade"
      src={url.toString()}
      allowpopups
    />
  );
}
