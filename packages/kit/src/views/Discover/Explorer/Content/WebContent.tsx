import { FC, memo, useState } from 'react';

import { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { webviewRefs } from '../Controller/webviewRefs';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const [navigationStateChangeEvent, setNavigationStateChangeEvent] =
    useState<WebViewNavigation>();
  const { gotoSite, openMatchDApp } = useWebController({
    id,
    navigationStateChangeEvent,
  });

  return id === 'home' || url === '' ? (
    <DiscoverHome
      // eslint-disable-next-line @typescript-eslint/no-shadow
      onItemSelect={({ url, name, favicon }) =>
        gotoSite({ url, title: name, favicon })
      }
      onItemSelectHistory={openMatchDApp}
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

export default memo(WebContent, () => true);
