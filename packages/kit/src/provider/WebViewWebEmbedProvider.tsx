import { memo, useEffect, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { WebViewWebEmbedSingleton } from '../components/WebViewWebEmbed';

function BasicWebViewWebEmbedProvider() {
  const [isShow, setIsShow] = useState(false);
  const [ts, setTs] = useState(0);
  useEffect(() => {
    const fn = () => {
      setIsShow(true);
      setTs(Date.now());
    };
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.LoadWebEmbedWebView, fn);
    };
  }, []);
  return isShow ? <WebViewWebEmbedSingleton key={ts} /> : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
