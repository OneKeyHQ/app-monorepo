import { useCallback, useRef } from 'react';

import WebView from '.';

import { useIsFocused } from '@react-navigation/native';

import { useDAppNotifyChangesBase } from '../../views/Discovery/hooks/useDAppNotifyChanges';

import type { IWebViewProps } from '.';
import type { IWebViewRef } from './types';

export function WebViewWithFeatures(
  props: IWebViewProps & {
    features?: { notifyChangedEventsToDappOnFocus?: boolean };
    /**
     * Live URL of the page, when it can navigate away from `src`. The dApp
     * notifications are addressed by origin, so after a cross-origin hop the
     * initial `src` would target an origin that is no longer loaded and the
     * page would never hear about an account or network switch. Kept separate
     * from `src` on purpose: `src` is controlled, and moving it would reload
     * the WebView on every navigation.
     */
    currentUrl?: string;
  },
) {
  const webviewRef = useRef<IWebViewRef | null>(null);
  const { features, currentUrl, ...webviewProps } = props;
  const { onWebViewRef, src } = webviewProps;
  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      webviewRef.current = ref;
      onWebViewRef?.(ref);
    },
    [onWebViewRef],
  );

  const notifyChangedEventsToDappOnFocus =
    features?.notifyChangedEventsToDappOnFocus;
  const shouldSkipNotify = useCallback(() => {
    return Boolean(!notifyChangedEventsToDappOnFocus);
  }, [notifyChangedEventsToDappOnFocus]);
  const getWebviewRef = useCallback(() => webviewRef.current, [webviewRef]);

  const isFocused = useIsFocused();
  useDAppNotifyChangesBase({
    getWebviewRef,
    isFocused,
    url: currentUrl || src,
    shouldSkipNotify,
  });

  return <WebView {...webviewProps} onWebViewRef={handleWebViewRef} />;
}
