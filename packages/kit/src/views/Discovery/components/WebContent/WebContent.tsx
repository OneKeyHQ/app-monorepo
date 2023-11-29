import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';

// import { setWebTabData } from '../../store/contextWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import WebView from '../WebView';

import type { IWebTab } from '../../types';
import type { WebViewProps } from 'react-native-webview';

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent: boolean;
    setBackEnabled?: Dispatch<SetStateAction<boolean>>;
    setForwardEnabled?: Dispatch<SetStateAction<boolean>>;
    addBrowserHistory?: (siteInfo: { url: string; title: string }) => void;
  };

function WebContent({ id, url }: IWebContentProps) {
  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              // void setWebTabData({
              //   id,
              //   refReady: true,
              // });
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
}

export default WebContent;
