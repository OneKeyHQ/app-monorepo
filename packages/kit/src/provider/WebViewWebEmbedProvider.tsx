import { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { WebViewWebEmbedSingleton } from '../components/WebViewWebEmbed';

function BasicWebViewWebEmbedProvider() {
  const [isShow, setIsShow] = useState(false);
  const isShowRef = useRef<boolean>(isShow);
  isShowRef.current = isShow;
  const [ts, setTs] = useState(0);
  const lastRequestIdRef = useRef<string | undefined>(undefined);
  const showWebEmbedWebView = useCallback(
    ({ reason, requestId }: { reason?: string; requestId?: string }) => {
      if (requestId && lastRequestIdRef.current === requestId) {
        return;
      }
      lastRequestIdRef.current = requestId;
      defaultLogger.app.webembed.showWebEmbedWebView({ reason });
      defaultLogger.app.webembed.webEmbedProviderEventReceived({
        reason: reason || 'unknown',
      });
      setIsShow(true);
      setTs((previous) => Math.max(previous + 1, Date.now()));
    },
    [],
  );

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (!isShowRef.current) {
  //       showWebEmbedWebView({ reason: 'setTimeout' });
  //     }
  //   }, 3000);
  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, [showWebEmbedWebView]);

  useEffect(() => {
    const fn = (payload?: { requestId: string }) => {
      showWebEmbedWebView({
        reason: 'eventBus.LoadWebEmbedWebView',
        requestId: payload?.requestId,
      });
    };
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    appEventBus.emit(EAppEventBusNames.WebEmbedWebViewProviderReady, undefined);
    return () => {
      appEventBus.off(EAppEventBusNames.LoadWebEmbedWebView, fn);
    };
  }, [showWebEmbedWebView]);
  return isShow ? <WebViewWebEmbedSingleton key={ts} /> : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
