import type { ViewStyle } from 'react-native';

export function WebView({ uri, style }: { uri: string; style: ViewStyle }) {
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
        src={uri}
        sandbox="allow-orientation-lock allow-scripts	allow-top-navigation allow-top-navigation-by-user-activation allow-same-origin allow-popups"
      />
    </div>
  );
}
