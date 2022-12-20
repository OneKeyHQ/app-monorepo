import type { FC } from 'react';
import { useMemo } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { setWebTabData } from '../../../../store/reducers/webTabs';
import { webviewRefs } from '../explorerUtils';

import type { WebTab } from '../../../../store/reducers/webTabs';
import type { WebViewProps } from 'react-native-webview';

const WebContent: FC<WebTab & WebViewProps> = ({ id, url }) => {
  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        onWebViewRef={(ref) => {
          const { dispatch } = backgroundApiProxy;
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              dispatch(setWebTabData({ id, refReady: true }));
            }
            webviewRefs[id] = ref;
          }
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  return webview;
};

WebContent.displayName = 'WebContent';

export default WebContent;
