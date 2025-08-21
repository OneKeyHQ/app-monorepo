import { useCallback, useRef } from 'react';

import WebView from '.';

import { useIsFocused } from '@react-navigation/native';

import { useDAppNotifyChangesBase } from '../../views/Discovery/hooks/useDAppNotifyChanges';

import type { IWebViewProps } from '.';
import type { IWebViewRef } from './types';

export function WebViewWithFeatures(
  props: IWebViewProps & {
    features?: { notifyChangedEventsToDappOnFocus?: boolean };
  },
) {
  const webviewRef = useRef<IWebViewRef | null>(null);
  const { onWebViewRef } = props;
  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      webviewRef.current = ref;
      onWebViewRef?.(ref);
    },
    [onWebViewRef],
  );

  const notifyChangedEventsToDappOnFocus =
    props?.features?.notifyChangedEventsToDappOnFocus;
  const shouldSkipNotify = useCallback(() => {
    return Boolean(!notifyChangedEventsToDappOnFocus);
  }, [notifyChangedEventsToDappOnFocus]);
  const getWebviewRef = useCallback(() => webviewRef.current, [webviewRef]);

  const isFocused = useIsFocused();
  useDAppNotifyChangesBase({
    getWebviewRef,
    isFocused,
    url: props?.src,
    shouldSkipNotify,
  });

  return <WebView {...props} onWebViewRef={handleWebViewRef} />;
}
