import { FC, useMemo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { WebTab, setWebTabData } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
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
  const refreshCondition = platformEnv.isNative
    ? url
    : // electron is using loadURL() to load url
      // instead of url props changing
      // so only refresh when url changed from '' to non-empty
      // that is, from DiscoverHome to other pages
      url === '';
  return useMemo(
    () =>
      showHome ? (
        // TODO avoid rerender, maybe singleton
        <DiscoverHome
          onItemSelect={(dapp) => {
            openMatchDApp({ id: dapp.id, dapp });
          }}
          onItemSelectHistory={openMatchDApp}
        />
      ) : (
        <WebView
          src={url}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshCondition],
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
