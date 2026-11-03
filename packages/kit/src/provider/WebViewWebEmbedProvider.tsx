import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getHomeTokenMainRuntimeId } from '@onekeyhq/shared/src/utils/homeTokenRequest';

import { WebViewWebEmbedSingleton } from '../components/WebViewWebEmbed';

let webEmbedMountSequence = 0;
const webEmbedMainRuntimeId =
  platformEnv.isNative && platformEnv.enableNativeBackgroundThread
    ? getHomeTokenMainRuntimeId()
    : undefined;

function BasicWebViewWebEmbedProvider() {
  const [devSettings] = useDevSettingsPersistAtom();
  const disabled = !!(
    devSettings.enabled && devSettings.settings?.disableWebEmbedApi
  );
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const pendingRequestIdRef = useRef<string | undefined>(undefined);
  const [isShow, setIsShow] = useState(false);
  const isShowRef = useRef<boolean>(isShow);
  isShowRef.current = isShow;
  const [mount, setMount] = useState<{
    mountId: string;
    mountSequence: number;
    requestId?: string;
  }>();
  const currentMountIdRef = useRef<string | undefined>(undefined);
  const isCurrentMount = useCallback(
    (mountId: string) => currentMountIdRef.current === mountId,
    [],
  );
  const lastRequestIdRef = useRef<string | undefined>(undefined);
  const showWebEmbedWebView = useCallback(
    ({
      reason,
      requestId,
      replaceMountId,
    }: {
      reason?: string;
      requestId?: string;
      replaceMountId?: string;
    }) => {
      if (replaceMountId && replaceMountId !== currentMountIdRef.current) {
        return;
      }
      pendingRequestIdRef.current = requestId;
      if (disabledRef.current) {
        setIsShow(true);
        return;
      }
      if (
        !replaceMountId &&
        currentMountIdRef.current &&
        requestId &&
        lastRequestIdRef.current === requestId
      ) {
        return;
      }
      lastRequestIdRef.current = requestId;
      webEmbedMountSequence += 1;
      const mountSequence = webEmbedMountSequence;
      const mountId = `${webEmbedMainRuntimeId || appEventBus.nodeId}-${mountSequence}`;
      currentMountIdRef.current = mountId;
      appEventBus.emit(EAppEventBusNames.WebEmbedWebViewMountRequested, {
        mountId,
        mountSequence,
      });
      defaultLogger.app.webembed.showWebEmbedWebView({ reason });
      defaultLogger.app.webembed.webEmbedProviderEventReceived({
        reason: reason || 'unknown',
      });
      setIsShow(true);
      setMount({ mountId, mountSequence, requestId });
    },
    [],
  );

  useEffect(() => {
    if (disabled) {
      currentMountIdRef.current = undefined;
      setMount(undefined);
    } else if (isShowRef.current && !currentMountIdRef.current) {
      showWebEmbedWebView({
        reason: 'enableWebEmbedApi',
        requestId: pendingRequestIdRef.current,
      });
    }
  }, [disabled, showWebEmbedWebView]);

  const handleContentProcessTerminate = useCallback(
    (mountId: string) => {
      showWebEmbedWebView({
        reason: 'contentProcessTerminated',
        requestId: pendingRequestIdRef.current,
        replaceMountId: mountId,
      });
    },
    [showWebEmbedWebView],
  );

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (!isShowRef.current) {
  //       showWebEmbedWebView({ reason: 'setTimeout' });
  //     }
  //   }, 3000);
  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, [showWebEmbedWebView]);

  useEffect(() => {
    const fn = (payload?: { requestId: string }) => {
      showWebEmbedWebView({
        reason: 'eventBus.LoadWebEmbedWebView',
        requestId: payload?.requestId,
      });
    };
    const onRuntimeProbe = ({ probeId }: { probeId: string }) => {
      if (webEmbedMainRuntimeId) {
        void appEventBus.emit(EAppEventBusNames.WebEmbedWebViewProviderReady, {
          mainRuntimeId: webEmbedMainRuntimeId,
          probeId,
        });
      }
    };
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    if (webEmbedMainRuntimeId) {
      appEventBus.on(
        EAppEventBusNames.WebEmbedWebViewRuntimeProbe,
        onRuntimeProbe,
      );
    }
    appEventBus.emit(
      EAppEventBusNames.WebEmbedWebViewProviderReady,
      webEmbedMainRuntimeId
        ? { mainRuntimeId: webEmbedMainRuntimeId }
        : undefined,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.LoadWebEmbedWebView, fn);
      if (webEmbedMainRuntimeId) {
        appEventBus.off(
          EAppEventBusNames.WebEmbedWebViewRuntimeProbe,
          onRuntimeProbe,
        );
      }
    };
  }, [showWebEmbedWebView]);
  if (disabled && isShow) {
    return <WebViewWebEmbedSingleton key="disabled" />;
  }
  return isShow && mount ? (
    <WebViewWebEmbedSingleton
      key={mount.mountId}
      mountId={mount.mountId}
      mountSequence={mount.mountSequence}
      requestId={mount.requestId}
      isCurrentMount={isCurrentMount}
      onContentProcessTerminate={handleContentProcessTerminate}
    />
  ) : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
