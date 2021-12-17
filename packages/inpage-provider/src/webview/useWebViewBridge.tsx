import { useRef, useState } from 'react';

import { WebView as ReactNativeWebView } from 'react-native-webview';

import JsBridgeBase from '../jsBridge/JsBridgeBase';
import { IElectronWebView } from '../types';

export type IWebViewWrapperRef = {
  innerRef?: ReactNativeWebView | IElectronWebView | null;
  jsBridge?: JsBridgeBase | null;
  reload?: () => void;
};

export default function useWebViewBridge() {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const [jsBridge, setJsBridge] = useState<JsBridgeBase | null>(null);

  // web3 provider
  // const [provider, setProvider] = useState(null);

  const setWebViewRef = (ref: IWebViewWrapperRef) => {
    webviewRef.current = ref;
    const newJsBridge = webviewRef.current?.jsBridge;
    if (newJsBridge) {
      setJsBridge(newJsBridge);
    }
  };

  return {
    jsBridge,
    // provider,
    webviewRef,
    setWebViewRef,
  };
}
