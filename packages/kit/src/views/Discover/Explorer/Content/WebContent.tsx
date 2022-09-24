import { FC, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../Controller/webviewRefs';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const { gotoSite } = useWebController({
    id,
    navigationStateChangeEvent,
  });
  return id === 'home' || url === '' ? (
    <DiscoverHome
      // eslint-disable-next-line @typescript-eslint/no-shadow
      onItemSelect={({ url, name, favicon }) =>
        gotoSite({ url, title: name, favicon })
      }
      onItemSelectHistory={({ dapp, webSite }) => {
        const site = dapp || webSite;
        if (site) {
          gotoSite({
            url: site.url,
            title: dapp?.name || site.url,
            favicon: site.favicon,
          });
        }
      }}
    />
  ) : (
    <WebView
      src={url}
      onWebViewRef={(ref) => {
        if (ref) {
          webviewRefs[id] = ref;
        } else {
          delete webviewRefs[id];
        }
      }}
      onNavigationStateChange={setNavigationStateChangeEvent}
      allowpopups
    />
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
