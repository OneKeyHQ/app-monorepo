import { FC, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  homeTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../explorerUtils';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();

  useWebController({
    id,
    navigationStateChangeEvent,
  });

  const showHome =
    (id === 'home' && webHandler === 'tabbedWebview') || url === homeTab.url;

  const webview = useMemo(
    () => (
      <WebView
        key={String(showHome)}
        src={url}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            dispatch(setWebTabData({ id, refReady: true }));
            webviewRefs[id] = ref;
          }
        }}
        onNavigationStateChange={
          showHome ? undefined : setNavigationStateChangeEvent
        }
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, showHome],
  );

  return webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
