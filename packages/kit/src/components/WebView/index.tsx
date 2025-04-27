import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';

import InpageProviderWebView from './InpageProviderWebView';

import type { IElectronWebViewEvents, IWebViewOnScroll } from './types';
import type { ESiteMode } from '../../views/Discovery/types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewProps as RNWebViewProps } from 'react-native-webview';
import type {
  WebViewErrorEvent,
  WebViewNavigation,
  WebViewNavigationEvent,
  WebViewOpenWindowEvent,
  WebViewSource,
} from 'react-native-webview/lib/WebViewTypes';

interface IWebViewProps extends IElectronWebViewEvents {
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
  onLoadStart?: (event: WebViewNavigationEvent) => void;
  onLoad?: (event: WebViewNavigationEvent) => void;
  onLoadEnd?: (event: WebViewNavigationEvent | WebViewErrorEvent) => void;
  onScroll?: IWebViewOnScroll;
  displayProgressBar?: boolean;
  onProgress?: (progress: number) => void;
  webviewDebuggingEnabled?: boolean;
  /** @platform native
   * @description Open website in desktop mode or mobile mode
   */
  siteMode?: ESiteMode;
  /** @platform native
   * @description List of origin strings to allow being navigated to.
   * The strings allow wildcards and follow the same rules as the navigator.
   * For example, ['https://*.onekey.so', 'https://*.onekey.com'] will allow any URL from these domains.
   */
  originWhitelist?: string[];
  /** @platform native
   * @description A function that is invoked when the webview calls `window.ReactNativeWebView.postMessage`. Setting this property will inject this global into your webview.
   */
  onMessage?: RNWebViewProps['onMessage'];
}

const WebView: FC<IWebViewProps> = ({
  src = '',
  openUrlInExt = false,
  allowpopups = false,
  onWebViewRef = () => {},
  customReceiveHandler,
  containerProps,
  webviewDebuggingEnabled,
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
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        src={src}
        allowpopups={allowpopups}
        receiveHandler={receiveHandler}
        {...rest}
      />
    </Stack>
  );
};

export default WebView;
