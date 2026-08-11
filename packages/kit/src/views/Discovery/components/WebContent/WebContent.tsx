import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo } from 'react';

import WebView from '@onekeyhq/kit/src/components/WebView';
import { tryDispatchTranslateMessage } from '@onekeyhq/kit/src/components/WebView/translateBridge';
import type {
  ICustomInjectionAutoReviewEvent,
  ICustomInjectionRecordingCommand,
  ICustomInjectionRecordingEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import { webviewRefs } from '../../utils/explorerUtils';

import type { IWebTab } from '../../types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';

type IWebContentProps = IWebTab &
  WebViewProps & {
    isCurrent: boolean;
    setBackEnabled?: Dispatch<SetStateAction<boolean>>;
    setForwardEnabled?: Dispatch<SetStateAction<boolean>>;
    customReceiveHandler?: IJsBridgeReceiveHandler;
    desktopPreloadUrl?: string;
    partition?: string;
    onCustomInjectionAutoReview?: (
      event: ICustomInjectionAutoReviewEvent,
    ) => void;
    customInjectionRecordingCommand?: ICustomInjectionRecordingCommand;
    onCustomInjectionRecordingEvent?: (
      event: ICustomInjectionRecordingEvent,
    ) => void;
    onCustomInjectionDidStartNavigation?: IElectronWebViewEvents['onDidStartNavigation'];
    onCustomInjectionDidRedirectNavigation?: IElectronWebViewEvents['onDidRedirectNavigation'];
    onCustomInjectionNavigationSettled?: (loaded: boolean) => void;
    onCustomInjectionDomReady?: () => void;
    isWebViewInstanceCurrent?: () => boolean;
  };

function WebContent({ id, url, customReceiveHandler }: IWebContentProps) {
  const { setWebTabData } = useBrowserTabActions().current;

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      tryDispatchTranslateMessage(id, event.nativeEvent.data);
    },
    [id],
  );

  const webview = useMemo(
    () => (
      <WebView
        id={id}
        src={url}
        customReceiveHandler={customReceiveHandler}
        onMessage={handleMessage}
        onWebViewRef={(ref) => {
          if (ref && ref.innerRef) {
            if (!webviewRefs[id]) {
              setWebTabData({
                id,
                refReady: true,
              });
            }
            webviewRefs[id] = ref;
          }
        }}
        allowpopups
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, customReceiveHandler],
  );

  return webview;
}

export default WebContent;
