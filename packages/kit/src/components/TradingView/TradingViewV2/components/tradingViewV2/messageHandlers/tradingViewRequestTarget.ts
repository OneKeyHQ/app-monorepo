import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

export function captureTradingViewRequestTarget({
  webRef,
  webViewLoadGeneration,
  isRequestCurrent,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  webViewLoadGeneration?: React.MutableRefObject<number>;
  isRequestCurrent?: () => boolean;
}) {
  const requestWebView = webRef.current;
  const requestWebViewLoadGeneration = webViewLoadGeneration?.current;

  const isCurrent = () => {
    const currentWebView = webRef.current;
    const requestIdentityCurrent = isRequestCurrent?.() ?? true;
    const documentIsCurrent =
      requestWebViewLoadGeneration === undefined
        ? currentWebView === requestWebView
        : webViewLoadGeneration?.current === requestWebViewLoadGeneration;
    const current =
      requestWebView &&
      currentWebView &&
      documentIsCurrent &&
      requestIdentityCurrent;
    return Boolean(current);
  };

  const sendMessage = (message: unknown) => {
    const currentWebView = webRef.current;
    if (!currentWebView || !isCurrent()) {
      return false;
    }
    currentWebView.sendMessageViaInjectedScript(message);
    return true;
  };

  return {
    isCurrent,
    requestWebView,
    sendMessage,
  };
}
