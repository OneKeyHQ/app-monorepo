import { useRef, useState } from 'react';
import { IJsBridge, IWebViewWrapperRef } from '../types';

export default function useWebViewBridge() {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const [jsBridge, setJsBridge] = useState<IJsBridge | null>(null);

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
