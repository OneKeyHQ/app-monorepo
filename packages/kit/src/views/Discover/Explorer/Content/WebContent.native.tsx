import { FC, useMemo, useState } from 'react';

import { View } from 'react-native';
import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  WebTab,
  homeTab,
  setWebTabData,
} from '../../../../store/reducers/webTabs';
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
    (id === 'home' && webHandler === 'tabbedWebview') || url === homeTab.url;

  const webview = useMemo(
    () => (
      <WebView
        src={url}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            dispatch(setWebTabData({ id, refReady: true }));
            webviewRefs[id] = ref;
          }
        }}
        onNavigationStateChange={setNavigationStateChangeEvent}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  return (
    <>
      {webview}
      {showHome && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            zIndex: 1,
          }}
        >
          <DiscoverHome
            onItemSelect={(dapp) => {
              openMatchDApp({ id: dapp._id, dapp });
            }}
            onItemSelectHistory={openMatchDApp}
          />
        </View>
      )}
    </>
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
