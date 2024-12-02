import { useEffect, useMemo } from 'react';

import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { ViewStyle } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

export function WebView({
  uri,
  style,
  onLoadEnd,
}: {
  uri: string;
  hash: string;
  query: string;
  htmlCode: string;
  style: ViewStyle;
} & WebViewProps & {
    onLoadEnd: () => void;
  }) {
  const iframeId = useMemo(() => generateUUID(), []);
  useEffect(() => {
    const frame = document.getElementById(iframeId) as HTMLIFrameElement;
    if (frame && uri) {
      frame.onload = () => {
        setTimeout(() => {
          onLoadEnd();
        }, 3000);
      };
    }
  }, [uri, iframeId, onLoadEnd]);
  return (
    <div style={style as any}>
      <iframe
        id={iframeId}
        src={uri}
        style={{
          height: '100%',
          width: '100%',
          border: 0,
        }}
        frameBorder="0"
        title="TradingView"
        sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin allow-popups"
      />
    </div>
  );
}
