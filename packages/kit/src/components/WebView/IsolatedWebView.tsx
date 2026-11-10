import type { FC } from 'react';
import { useCallback, useRef } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';

import IsolatedPlatformWebView from './IsolatedPlatformWebView';

import type { IWebViewProps, IWebViewRef } from './types';

/**
 * Bridge-free WebView component for isolated pages (e.g. Intercom Support,
 * Desktop Prime checkout, or content-only modals).
 *
 * Unlike `WebView` / `InpageProviderWebView`, this component:
 * - Never injects the dApp inpage provider (`preload.js` or `injectedNativeCode`)
 * - Never instantiates `JsBridgeDesktopHost` / `JsBridgeNativeHost`
 * - Never calls `backgroundApiProxy.connectBridge` or `bridgeReceiveHandler`
 */
export const IsolatedWebView: FC<IWebViewProps> = ({
  src = '',
  openUrlInExt = false,
  allowpopups = false,
  onWebViewRef = () => {},
  customReceiveHandler,
  containerProps,
  webviewDebuggingEnabled,
  pullToRefreshEnabled,
  ...rest
}) => {
  const webviewRef = useRef<IWebViewRef | null>(null);
  const handleWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      webviewRef.current = ref;
      onWebViewRef(ref);
    },
    [onWebViewRef],
  );

  if (
    platformEnv.isExtension &&
    !platformEnv.isExtensionUiExpandTab &&
    openUrlInExt
  ) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Button
          testID="web-view-open-btn"
          onPress={() => extUtils.openUrlInTab(src)}
        >
          Open
        </Button>
      </Stack>
    );
  }

  return (
    <Stack flex={1} bg="background-default" {...containerProps}>
      <IsolatedPlatformWebView
        ref={handleWebViewRef}
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        src={src}
        allowpopups={allowpopups}
        receiveHandler={customReceiveHandler}
        pullToRefreshEnabled={pullToRefreshEnabled}
        {...rest}
      />
    </Stack>
  );
};

export default IsolatedWebView;
