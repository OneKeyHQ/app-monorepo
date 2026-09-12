import { useLayoutEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

interface ITradingViewProps {
  uri: string;
  injectedJavaScript: string;
}

interface IWebViewProps {
  tradingViewProps: ITradingViewProps;
  style: ViewStyle;
  onLoadEnd: () => void;
  onLoadError?: () => void;
}

export function WebView({
  tradingViewProps: { uri, injectedJavaScript },
  style,
  onLoadEnd,
  onLoadError,
}: IWebViewProps): JSX.Element | null {
  const ref = useRef<HTMLWebViewElement | null>(null);

  useLayoutEffect(() => {
    const webview = ref.current;
    if (webview) {
      let loadEndTimer: ReturnType<typeof setTimeout> | undefined;
      const handleDomReady = () => {
        (
          webview as unknown as {
            executeJavaScript: (
              code: string,
              userGesture: boolean,
            ) => Promise<unknown>;
          }
        )
          .executeJavaScript(injectedJavaScript, true)
          .catch(() => undefined);
      };
      const handleFinished = () => {
        loadEndTimer = setTimeout(() => {
          onLoadEnd();
        }, 100);
      };
      const handleFailed = (event: Event) => {
        const { errorCode, isMainFrame } = event as Event & {
          errorCode: number;
          isMainFrame: boolean;
        };
        // Aborted navigations and failed child frames do not invalidate the chart.
        if (errorCode !== -3 && isMainFrame) {
          clearTimeout(loadEndTimer);
          onLoadError?.();
        }
      };
      const handleNavigate = (event: Event) => {
        event.preventDefault();
      };
      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('did-finish-load', handleFinished);
      webview.addEventListener('did-fail-load', handleFailed);
      webview.addEventListener('will-navigate', handleNavigate);
      return () => {
        clearTimeout(loadEndTimer);
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('did-finish-load', handleFinished);
        webview.removeEventListener('did-fail-load', handleFailed);
        webview.removeEventListener('will-navigate', handleNavigate);
      };
    }
  }, [injectedJavaScript, onLoadEnd, onLoadError, uri]);

  return uri ? (
    <Stack style={style}>
      <webview style={{ flex: 1 }} ref={ref} src={uri} />
    </Stack>
  ) : null;
}
