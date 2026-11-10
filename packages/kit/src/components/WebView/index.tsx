import type { FC } from 'react';
import { useCallback, useRef } from 'react';

import { Button, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { markWebEmbedChannelPayload } from '@onekeyhq/shared/src/utils/webEmbedChannelUtils';

import InpageProviderWebView from './InpageProviderWebView';
import IsolatedWebView from './IsolatedWebView';

import type { IWebViewProps, IWebViewRef } from './types';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';

export type { IWebViewProps };

const WebView: FC<IWebViewProps> = ({
  src = '',
  openUrlInExt = false,
  allowpopups = false,
  onWebViewRef = () => {},
  customReceiveHandler,
  containerProps,
  webviewDebuggingEnabled,
  pullToRefreshEnabled,
  skipBackgroundBridge,
  isWebEmbedChannel,
  ...rest
}) => {
  const receiveHandler = useCallback<IJsBridgeReceiveHandler>(
    async (payload, hostBridge) => {
      const customResult = await customReceiveHandler?.(payload, hostBridge);

      if (skipBackgroundBridge) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return customResult;
      }

      const result = await backgroundApiProxy.bridgeReceiveHandler(
        markWebEmbedChannelPayload(payload, !!isWebEmbedChannel),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    },
    [customReceiveHandler, skipBackgroundBridge, isWebEmbedChannel],
  );
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
  if (rest.disableBridge) {
    return (
      <IsolatedWebView
        src={src}
        openUrlInExt={openUrlInExt}
        allowpopups={allowpopups}
        onWebViewRef={onWebViewRef}
        customReceiveHandler={customReceiveHandler}
        containerProps={containerProps}
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        pullToRefreshEnabled={pullToRefreshEnabled}
        {...rest}
      />
    );
  }
  return (
    <Stack flex={1} bg="background-default" {...containerProps}>
      <InpageProviderWebView
        ref={handleWebViewRef}
        webviewDebuggingEnabled={webviewDebuggingEnabled}
        src={src}
        allowpopups={allowpopups}
        receiveHandler={receiveHandler}
        pullToRefreshEnabled={pullToRefreshEnabled}
        {...rest}
      />
    </Stack>
  );
};

export default WebView;
