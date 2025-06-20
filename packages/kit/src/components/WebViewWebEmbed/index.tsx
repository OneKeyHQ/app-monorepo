import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SizableText, Stack, View, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src//background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { analytics } from '@onekeyhq/shared/src/analytics';
import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { captureException } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { EWebEmbedPostMessageType } from '@onekeyhq/shared/src/modules3rdParty/webEmebd/postMessage';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import webEmbedConfig from '@onekeyhq/shared/src/storage/webEmbedConfig';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IWebEmbedOnekeyAppSettings } from '@onekeyhq/web-embed/utils/webEmbedAppSettings';

import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { GlobalJotaiReady } from '../GlobalJotaiReady/GlobalJotaiReady';
import WebView from '../WebView';

import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const initTop = '15%';
// /onboarding/auto_typing
export function WebViewWebEmbed({
  isSingleton,
  customReceiveHandler,
  hashRoutePath,
  hashRouteQueryParams,
}: {
  isSingleton?: boolean;
  customReceiveHandler?: IJsBridgeReceiveHandler;
  hashRoutePath?: EWebEmbedRoutePath;
  hashRouteQueryParams?: Record<string, string>;
}) {
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { instanceId } = settingsPersistAtom;

  const webviewRef = useRef<IWebViewWrapperRef | null>(null);
  const onWebViewRef = useCallback(($ref: IWebViewWrapperRef | null) => {
    webviewRef.current = $ref;
  }, []);
  const [top, setTop] = useState(initTop);
  const [minimized, setMinimized] = useState(false);
  const config = useMemo(() => webEmbedConfig.getWebEmbedConfig(), []);
  const themeVariant = useThemeVariant();
  const localeVariant = useLocaleVariant();
  const [devSettingsPersistAtom] = useDevSettingsPersistAtom();

  const [revenuecatApiKey, setRevenuecatApiKey] = useState<string>('');

  useEffect(() => {
    async function getApiKey() {
      const devSettings =
        await backgroundApiProxy.serviceDevSetting.getDevSetting();
      let apiKey = REVENUECAT_API_KEY_WEB;
      if (devSettings?.settings?.usePrimeSandboxPayment) {
        apiKey = REVENUECAT_API_KEY_WEB_SANDBOX;
      }
      if (!apiKey) {
        throw new OneKeyLocalError('No REVENUECAT api key found');
      }
      setRevenuecatApiKey(apiKey);
    }
    void getApiKey();
  }, []);

  const webEmbedAppSettings = useMemo<
    IWebEmbedOnekeyAppSettings | undefined
  >(() => {
    if (!themeVariant || !localeVariant || !revenuecatApiKey) {
      return undefined;
    }
    return {
      $settings: settingsPersistAtom,
      $devSettings: devSettingsPersistAtom,
      isDev: platformEnv.isDev ?? false,
      enableTestEndpoint:
        (devSettingsPersistAtom.enabled &&
          devSettingsPersistAtom.settings?.enableTestEndpoint) ??
        false,
      instanceId,
      platform: platformEnv.symbol ?? '',
      appBuildNumber: platformEnv.buildNumber ?? '',
      appVersion: platformEnv.version ?? '',
      themeVariant,
      localeVariant,
      revenuecatApiKey,
    };
  }, [
    themeVariant,
    localeVariant,
    revenuecatApiKey,
    settingsPersistAtom,
    devSettingsPersistAtom,
    instanceId,
  ]);

  const remoteUrl = useMemo(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      devSettingsPersistAtom.enabled
    ) {
      if (config?.url) {
        return config?.url;
      }
    }
    return undefined;
  }, [config?.url, devSettingsPersistAtom.enabled]);

  const nativeWebviewSource = useMemo(() => {
    if (remoteUrl) {
      return undefined;
    }
    // Android
    if (platformEnv.isNativeAndroid) {
      return {
        uri: 'file:///android_asset/web-embed/index.html',
      };
    }
    // iOS
    if (platformEnv.isNativeIOS) {
      return {
        uri: 'web-embed/index.html',
      };
    }
    return undefined;
  }, [remoteUrl]);

  // Handle messages from WebView - only works in native environments
  const handleMessage = useCallback((event?: WebViewMessageEvent) => {
    if (event?.nativeEvent.data) {
      let data:
        | {
            type: string;
            data: any;
          }
        | undefined;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch (error) {
        console.error(error);
      }
      if (!data) {
        return;
      }
      switch (data.type) {
        case EWebEmbedPostMessageType.TrackEvent:
          {
            const { eventName, eventProps } = data.data as {
              eventName: string;
              eventProps: Record<string, any>;
            };
            analytics.trackEvent(eventName, eventProps);
          }

          break;
        case EWebEmbedPostMessageType.CaptureException: {
          const { error, stackTrace } = data.data as {
            error: string;
            stackTrace: Record<string, string>;
          };
          if (error) {
            const errorObj = new Error(error);
            errorObj.stack = JSON.stringify(stackTrace);
            captureException(errorObj);
          }
          break;
        }
        default:
          break;
      }
    }
  }, []);

  const webview = useMemo(() => {
    if (!webEmbedAppSettings) {
      return null;
    }
    const fullHash = uriUtils.buildUrl({
      path: hashRoutePath,
      query: hashRouteQueryParams,
    });
    console.log('WebViewWebEmbed fullHash', hashRoutePath, fullHash);

    if (
      devSettingsPersistAtom.enabled &&
      devSettingsPersistAtom.settings?.disableWebEmbedApi
    ) {
      return (
        <SizableText>
          WebEmbedApi is disabled, please enable it in dev settings
        </SizableText>
      );
    }

    defaultLogger.app.webembed.renderWebview();

    return (
      <WebView
        pullToRefreshEnabled={false}
        useGeckoView={false}
        // *** use remote url
        src={remoteUrl || ''}
        // *** use web-embed local html file
        nativeWebviewSource={nativeWebviewSource}
        onWebViewRef={onWebViewRef}
        customReceiveHandler={customReceiveHandler}
        onMessage={handleMessage}
        nativeInjectedJavaScriptBeforeContentLoaded={`
            window.location.hash = "${fullHash}";
            const WEB_EMBED_ONEKEY_APP_SETTINGS = ${JSON.stringify(
              webEmbedAppSettings,
            )};
            window.WEB_EMBED_ONEKEY_APP_SETTINGS = WEB_EMBED_ONEKEY_APP_SETTINGS;
            if (typeof window !== 'undefined' && 'wrappedJSObject' in window) {
              try {
                window.wrappedJSObject.WEB_EMBED_ONEKEY_APP_SETTINGS = globalThis.cloneInto(
                  WEB_EMBED_ONEKEY_APP_SETTINGS,
                  window,
                  {
                    cloneFunctions: true
                  }
                );
              } catch (error) {
                console.error('cloneInto error', error);
              }
            }
          `}
      />
    );
  }, [
    customReceiveHandler,
    handleMessage,
    hashRoutePath,
    hashRouteQueryParams,
    nativeWebviewSource,
    onWebViewRef,
    remoteUrl,
    webEmbedAppSettings,
    devSettingsPersistAtom,
  ]);

  useEffect(() => {
    if (!platformEnv.isNative) {
      return;
    }
    const jsBridge = webviewRef?.current?.jsBridge;
    if (!jsBridge) {
      return;
    }
    if (!webview) {
      return;
    }
    if (!webEmbedAppSettings) {
      return;
    }
    jsBridge.globalOnMessageEnabled = true;
    backgroundApiProxy.connectWebEmbedBridge(
      jsBridge as unknown as JsBridgeBase,
    );
  }, [webviewRef, webview, webEmbedAppSettings]);

  const webviewUrlOrUri = useMemo(() => {
    if (remoteUrl) {
      return remoteUrl;
    }
    return nativeWebviewSource?.uri || '';
  }, [nativeWebviewSource?.uri, remoteUrl]);

  const debugViewSize = useMemo(() => {
    if (config?.debug) {
      if (minimized) {
        return { width: '$8', height: '$6', borderWidth: 4 };
      }
      return { width: '90%', height: '$60', borderWidth: 4 };
    }
    return { width: 0, height: 0, borderWidth: 0 };
  }, [config?.debug, minimized]);

  if (!isSingleton) {
    return webview;
  }

  return (
    <View
      width={debugViewSize.width}
      height={debugViewSize.height}
      borderWidth={debugViewSize.borderWidth}
      top={top}
      left="5%"
      position="absolute"
      backgroundColor="$background"
      borderColor="$border"
    >
      {config?.debug && webviewUrlOrUri ? (
        <Stack>
          <XStack borderBottomWidth={2} borderColor="$border">
            <SizableText
              px="$2"
              size="$bodySm"
              onPress={() => {
                setMinimized((v) => !v);
              }}
            >
              X
            </SizableText>
            <SizableText
              flex={1}
              onPress={() => {
                setTop(top === initTop ? '70%' : initTop);
              }}
              size="$bodySm"
            >
              {webviewUrlOrUri}
            </SizableText>
          </XStack>
        </Stack>
      ) : null}
      {webview}
    </View>
  );
}

function WebViewWebEmbedSingletonView() {
  console.log('WebViewWebEmbedSingletonView render');
  defaultLogger.app.webembed.renderWebviewSingleton();
  return (
    <GlobalJotaiReady>
      <WebViewWebEmbed
        isSingleton
        hashRoutePath={EWebEmbedRoutePath.webEmbedApi}
      />
    </GlobalJotaiReady>
  );
}

export const WebViewWebEmbedSingleton = memo(WebViewWebEmbedSingletonView);
