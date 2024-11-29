import { useEffect, useMemo } from 'react';

import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { ViewStyle } from 'react-native';
import type { WebViewProps } from 'react-native-webview';

export function WebView({
  uri,
  style,
  onLoadEnd,
}: { uri: string; style: ViewStyle } & WebViewProps & {
    onLoadEnd: () => void;
  }) {
  const iframeId = useMemo(() => generateUUID(), []);
  useEffect(() => {
    const frame = document.getElementById(iframeId);
    if (frame) {
      frame.onload = () => {
        setTimeout(() => {
          onLoadEnd();
        }, 1000);
      };
    }
  }, [iframeId, onLoadEnd]);
  return (
    <div style={style as any}>
      <iframe
        id={iframeId}
        style={{
          height: '100%',
          width: '100%',
          border: 0,
        }}
        frameBorder="0"
        title="TradingView"
        src={uri}
        sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin allow-popups"
      />
    </div>
  );
}
