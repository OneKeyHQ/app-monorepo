import { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { WebViewWebEmbedSingleton } from '../components/WebViewWebEmbed';

let webEmbedMountSequence = 0;

function BasicWebViewWebEmbedProvider() {
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
    ({ reason, requestId }: { reason?: string; requestId?: string }) => {
      if (requestId && lastRequestIdRef.current === requestId) {
        return;
      }
      lastRequestIdRef.current = requestId;
      webEmbedMountSequence += 1;
      const mountSequence = webEmbedMountSequence;
      const mountId = `${appEventBus.nodeId}-${mountSequence}`;
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
    appEventBus.on(EAppEventBusNames.LoadWebEmbedWebView, fn);
    appEventBus.emit(EAppEventBusNames.WebEmbedWebViewProviderReady, undefined);
    return () => {
      appEventBus.off(EAppEventBusNames.LoadWebEmbedWebView, fn);
    };
  }, [showWebEmbedWebView]);
  return isShow && mount ? (
    <WebViewWebEmbedSingleton
      key={mount.mountId}
      mountId={mount.mountId}
      mountSequence={mount.mountSequence}
      requestId={mount.requestId}
      isCurrentMount={isCurrentMount}
    />
  ) : null;
}

export const WebViewWebEmbedProvider = memo(BasicWebViewWebEmbedProvider);
