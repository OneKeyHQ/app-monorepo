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
const WEB_EMBED_PENDING_MOUNT_COALESCE_WINDOW_MS = 30 * 1000;
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
  const isMountPendingRef = useRef(false);
  const mountRequestedAtRef = useRef(0);
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
      pendingRequestIdRef.current = requestId ?? lastRequestIdRef.current;
      if (disabledRef.current) {
        setIsShow(true);
        return;
      }
      if (!replaceMountId && currentMountIdRef.current && requestId) {
        if (lastRequestIdRef.current === requestId) {
          return;
        }
        const isPendingWithinWindow =
          isMountPendingRef.current &&
          Date.now() - mountRequestedAtRef.current <
            WEB_EMBED_PENDING_MOUNT_COALESCE_WINDOW_MS;
        if (isPendingWithinWindow && !lastRequestIdRef.current) {
          lastRequestIdRef.current = requestId;
          pendingRequestIdRef.current = requestId;
          const currentMountId = currentMountIdRef.current;
          setMount((prev) =>
            prev && prev.mountId === currentMountId
              ? { ...prev, requestId }
              : prev,
          );
          return;
        }
      }
      lastRequestIdRef.current = requestId;
      webEmbedMountSequence += 1;
      const mountSequence = webEmbedMountSequence;
      const mountId = `${webEmbedMainRuntimeId || appEventBus.nodeId}-${mountSequence}`;
      currentMountIdRef.current = mountId;
      isMountPendingRef.current = true;
      mountRequestedAtRef.current = Date.now();
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
      isMountPendingRef.current = false;
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
    const onMountSettled = (payload?: { mountId?: string }) => {
      if (payload?.mountId && payload.mountId === currentMountIdRef.current) {
        isMountPendingRef.current = false;
      }
    };
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    appEventBus.on(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      onMountSettled,
    );
    appEventBus.on(EAppEventBusNames.WebEmbedWebViewNotReady, onMountSettled);
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
      appEventBus.off(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
        onMountSettled,
      );
      appEventBus.off(
        EAppEventBusNames.WebEmbedWebViewNotReady,
        onMountSettled,
      );
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
