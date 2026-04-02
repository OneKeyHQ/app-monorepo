import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export interface IGeckoViewProps extends ViewProps {
  source?: { html?: string; uri?: string };
  forceDarkOn?: boolean;
  autoFillEnabled?: boolean;
  remoteDebugging?: boolean;
  userAgent?: string;
  onLoadingStart?: (event: NativeSyntheticEvent<{ uri: string }>) => void;
  onLoadingFinish?: (event: NativeSyntheticEvent<{ success: string }>) => void;
  onLoadingError?: (
    event: NativeSyntheticEvent<{ error: string; uri: string }>,
  ) => void;
  onMessage?: (event: NativeSyntheticEvent<{ data: any; url: string }>) => void;
  onLoadingProgress?: (
    event: NativeSyntheticEvent<{ progress: number }>,
  ) => void;
  onMessagingDisconnected?: () => void;
  injectedJavaScript?: string;
  injectedJavaScriptBeforeContentLoaded?: string;
}

export type IWebViewCommands = {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stopLoading: () => void;
  postMessage: (message: string) => void;
  injectJavaScript: (script: string) => void;
  loadUrl: (url: string) => void;
  requestFocus: () => void;
  clearHistory: () => void;
  clearCache: () => void;
  connectMessagingPort: () => void;
};
