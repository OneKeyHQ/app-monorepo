import { memo, useEffect, useState } from 'react';

import { WebViewWebEmbed } from '@onekeyhq/kit/src/views/Discovery/components/WebView/WebViewWebEmbed';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

function BasicWebViewWebEmbedProvider() {
  const [isShow, setIsShow] = useState(false);
  useEffect(() => {
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, () => {
      setIsShow(true);
    });
  }, []);
  return isShow ? <WebViewWebEmbed /> : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
