import { useMemo } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ViewStyle } from 'react-native';

export function WebView({
  htmlCode,
  style,
}: {
  htmlCode: string;
  style: ViewStyle;
}) {
  const url = useMemo(() => {
    if (!platformEnv.isNative) {
      const blob = new Blob([htmlCode], {
        type: 'text/html',
      });
      return URL.createObjectURL(blob);
    }
  }, [htmlCode]);

  return (
    <div style={style as any}>
      <iframe
        style={{
          height: '100%',
          width: '100%',
          border: 0,
        }}
        frameBorder="0"
        title="TradingView"
        src={url}
        sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin allow-popups"
      />
    </div>
  );
}
