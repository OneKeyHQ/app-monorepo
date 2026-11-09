import type { ComponentProps } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';

import { WebViewWithFeatures } from '@onekeyhq/kit/src/components/WebView/WebViewWithFeatures';
import { useWebviewPerpTradeTargetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HYPER_LIQUID_WEBVIEW_TRADE_URL,
  WEBVIEW_PERP_TRADE_INITIAL_WAIT_MS,
} from '@onekeyhq/shared/src/consts/perp';
import type {
  ETabRoutes,
  IWebviewPerpTradeParamList,
} from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/native';

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
  const { params } =
    useRoute<
      RouteProp<IWebviewPerpTradeParamList, ETabRoutes.WebviewPerpTrade>
    >();
  const tradeRequest = params?.tradeRequest;
  const hasRenderedWebView = useRef(false);
  const [initialWaitExpired, setInitialWaitExpired] = useState(false);
  const waitingForInitialTarget =
    !hasRenderedWebView.current &&
    !initialWaitExpired &&
    Boolean(
      tradeRequest &&
      tradeRequest.requestId !== target.requestId &&
      tradeRequest.expiresAt > Date.now(),
    );
  useEffect(() => {
    if (!waitingForInitialTarget || !tradeRequest) return;
    // Only this route's entry can delay its first load. Other windows' drafts
    // are BG-owned and never participate in this UI's readiness.
    const timeout = setTimeout(
      () => setInitialWaitExpired(true),
      Math.max(
        0,
        Math.min(
          WEBVIEW_PERP_TRADE_INITIAL_WAIT_MS,
          tradeRequest.expiresAt - Date.now(),
        ),
      ),
    );
    return () => clearTimeout(timeout);
  }, [waitingForInitialTarget, tradeRequest]);
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
