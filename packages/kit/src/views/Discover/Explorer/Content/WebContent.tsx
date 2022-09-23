import { FC, useContext } from 'react';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';
import { useWebController } from '../Controller/useWebController';
import { WebviewRefsContext } from '../Controller/WebviewRefsContext';

const WebContent: FC<WebTab> = ({ id, url }) => {
  const webviewRefs = useContext(WebviewRefsContext);
  // const { gotoUrl } = useWebController({
  //   id,
  // });
  return id === 'home' || url === '' ? (
    <DiscoverHome
      onItemSelect={(item) => gotoUrl({ id: item.id, dapp: item })}
      onItemSelectHistory={(item) => gotoUrl(item)}
    />
  ) : (
    <WebView
      src={url}
      onWebViewRef={(ref) => {
        if (ref) {
          webviewRefs[id] = ref;
        }
      }}
      // onNavigationStateChange={setNavigationStateChangeEvent}
      allowpopups
    />
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
