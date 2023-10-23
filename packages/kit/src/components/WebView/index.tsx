import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';

import InpageProviderWebView from './InpageProviderWebView';
import { backgroundApiProxy } from './mock';

import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  WebViewNavigation,
  WebViewOpenWindowEvent,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

interface WebViewProps {
  id?: string;
  src?: string;
  onSrcChange?: (src: string) => void;
  openUrlInExt?: boolean;
  onWebViewRef?: (ref: IWebViewWrapperRef | null) => void;
  onNavigationStateChange?: (event: WebViewNavigation) => void;
  onShouldStartLoadWithRequest?: (event: WebViewNavigation) => boolean;
  allowpopups?: boolean;
  containerProps?: ComponentProps<typeof Stack>;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  nativeWebviewSource?: WebViewSource | undefined;
  nativeInjectedJavaScriptBeforeContentLoaded?: string;
  isSpinnerLoading?: boolean;
  onContentLoaded?: () => void; // currently works in NativeWebView only
  onOpenWindow?: (event: WebViewOpenWindowEvent) => void;
  androidLayerType?: 'none' | 'software' | 'hardware';
}

const WebView: FC<WebViewProps> = ({
  src = '',
  openUrlInExt = false,
  allowpopups = false,
  onWebViewRef = () => {},
  customReceiveHandler,
  containerProps,
  ...rest
}) => {
  const receiveHandler = useCallback<IJsBridgeReceiveHandler>(
    async (payload, hostBridge) => {
      const result = await backgroundApiProxy.bridgeReceiveHandler(payload);

      // return customReceiveHandler() response not supported yet
      await customReceiveHandler?.(payload, hostBridge);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    },
    [customReceiveHandler],
  );

  if (
    platformEnv.isExtension &&
    !platformEnv.isExtensionUiExpandTab &&
    openUrlInExt
  ) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Button onPress={() => extUtils.openUrlInTab(src)}>Open</Button>
      </Stack>
    );
  }
  return (
    <Stack flex={1} bg="background-default" {...containerProps}>
      <InpageProviderWebView
        ref={onWebViewRef}
        src={src}
        allowpopups={allowpopups}
        receiveHandler={receiveHandler}
        {...rest}
      />
    </Stack>
  );
};

export default WebView;
