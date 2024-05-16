import { memo, useEffect, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { WebViewWebEmbed } from '../components/WebViewWebEmbed';

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
