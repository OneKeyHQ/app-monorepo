import { memo, useEffect, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { WebViewWebEmbedSingleton } from '../components/WebViewWebEmbed';

function BasicWebViewWebEmbedProvider() {
  const [isShow, setIsShow] = useState(false);
  useEffect(() => {
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, () => {
      setIsShow(true);
    });
  }, []);
  return isShow ? <WebViewWebEmbedSingleton /> : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
