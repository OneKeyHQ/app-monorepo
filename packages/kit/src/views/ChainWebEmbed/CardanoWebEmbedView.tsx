import { useCallback, useEffect, useRef } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import { Box, Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebView/WebViewWebEmbed';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function CardanoWebEmbedView() {
  const webviewRef = useRef<IWebViewWrapperRef | null>(null);

  const onWebViewRef = useCallback((ref: IWebViewWrapperRef | null) => {
    console.log('get webview ref');
    webviewRef.current = ref;
  }, []);

  const onBridge = async () => {
    const result = await backgroundApiProxy.serviceDapp.sendWebEmbedMessage({
      method: 'callCardanoWebEmbedMethod',
      event: 'Cardano_composeTxPlan',
      params: {
        hex: '1123123123123',
      },
    });
    console.log('onBridge result $$$$$$$$$$=====> : ', result);
  };
  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }

    const jsBridge = webviewRef?.current?.jsBridge;
    if (!jsBridge) {
      return;
    }
    jsBridge.globalOnMessageEnabled = true;
    backgroundApiProxy.connectBridge(jsBridge);
    console.log('connect bridge! =====>');
  }, [webviewRef]);

  const routePath = '/cardano';

  return (
    <Box minH="10px" minW="10px" flex="1">
      <Button
        onPress={() => {
          onBridge();
        }}
      >
        Bridge
      </Button>
      <WebViewWebEmbed
        isSpinnerLoading
        onWebViewRef={onWebViewRef}
        onContentLoaded={() => {
          console.log('Loaded');
        }}
        // customReceiveHandler={receiveHandler}
        // *** use web-embed local html file
        routePath={routePath}
        // *** use remote url
        src={
          platformEnv.isDev
            ? `http://192.168.50.36:3008/#${routePath}`
            : undefined
        }
      />
    </Box>
  );
}
