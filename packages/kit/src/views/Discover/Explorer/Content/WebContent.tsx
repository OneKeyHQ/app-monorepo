import { FC } from 'react';

import { Box } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home/DiscoverHome';

const WebContent: FC<WebTab> = ({ id, url }) =>
  id === 'home' || url === '' ? (
    <DiscoverHome
      onItemSelect={(item) => gotoUrl({ id: item.id, dapp: item })}
      onItemSelectHistory={(item) => gotoUrl(item)}
    />
  ) : (
    <WebView
      src={url}
      // onWebViewRef={(ref) => {
      //   setWebviewRef(ref);
      // }}
      // onNavigationStateChange={setNavigationStateChangeEvent}
      allowpopups
    />
  );

WebContent.displayName = 'WebContent';

export default WebContent;
