import type { ComponentProps } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { WebViewWithFeatures } from '@onekeyhq/kit/src/components/WebView/WebViewWithFeatures';
import { useWebviewPerpTradeTargetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HYPER_LIQUID_WEBVIEW_TRADE_URL } from '@onekeyhq/shared/src/consts/perp';

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
  const waitingForInitialTarget =
    !hasRenderedWebView.current && Boolean(target.pending);
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
