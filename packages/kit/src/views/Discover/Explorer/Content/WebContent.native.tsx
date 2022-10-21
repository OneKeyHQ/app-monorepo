import { FC, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';
import { webHandler, webviewRefs } from '../explorerUtils';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();

  const { openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  const showHome =
    (id === 'home' && webHandler === 'tabbedWebview') || url === '';

  const discoverHome = useMemo(
    () => (
      <DiscoverHome
        onItemSelect={(dapp) => {
          openMatchDApp({ id: dapp._id, dapp });
        }}
        onItemSelectHistory={openMatchDApp}
      />
    ),
    [openMatchDApp],
  );

  const webview = useMemo(
    () => (
      <WebView
        src={url || 'about:blank'}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            webviewRefs[id] = ref;
            dispatch(setWebTabData({ id, refReady: true }));
          } else {
            delete webviewRefs[id];
            dispatch(setWebTabData({ id, refReady: false }));
          }
        }}
        onNavigationStateChange={setNavigationStateChangeEvent}
        allowpopups
      />
    ),
    [id, url],
  );

  return showHome ? discoverHome : webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
