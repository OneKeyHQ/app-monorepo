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
  const showWebEmbedWebView = useCallback(({ reason }: { reason?: string }) => {
    defaultLogger.app.webembed.showWebEmbedWebView({ reason });
    setIsShow(true);
    setTs(Date.now());
  }, []);

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
    const fn = () => {
      showWebEmbedWebView({ reason: 'eventBus.LoadWebEmbedWebView' });
    };
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.LoadWebEmbedWebView, fn);
    };
  }, [showWebEmbedWebView]);
  return isShow ? <WebViewWebEmbedSingleton key={ts} /> : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
