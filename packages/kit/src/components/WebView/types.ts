import type { InpageProviderWebViewProps as InpageWebViewProps } from '@onekeyfe/cross-inpage-provider-types';
import type { WebViewSource } from 'react-native-webview/lib/WebViewTypes';

export interface InpageProviderWebViewProps extends InpageWebViewProps {
  id?: string;
  onNavigationStateChange?: (event: any) => void;
  onShouldStartLoadWithRequest?: (event: any) => boolean;
  allowpopups?: boolean;
  nativeWebviewSource?: WebViewSource;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: any) => void;
  androidLayerType?: 'none' | 'software' | 'hardware';
  scrolling?: 'auto' | 'yes' | 'no';
}
