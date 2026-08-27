import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Stack } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewProps } from '@onekeyhq/kit/src/components/WebView';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import {
  createTradingViewEmbedReadyMonitor,
  isTradingViewChartReadyPayload,
  isTradingViewVisualReadyPayload,
} from './tradingViewEmbedReady.web';
import { migrateLegacyTradingViewStorage } from './tradingViewLegacyStorageMigration.web';

import type { ITradingViewEmbedHandle } from './tradingViewEmbedLoader.web';
import type { ITradingViewRuntimeViewProps } from './TradingViewRuntimeView.types';
import type { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';

type ILoadedTradingViewEmbed = Awaited<
  ReturnType<typeof loadTradingViewEmbedModule>
>;

export const TRADING_VIEW_EMBED_STARTUP_TIMEOUT_MS = 10_000;

interface ITradingViewRuntimeRefs {
  customReceiveHandler: {
    current: IWebViewProps['customReceiveHandler'];
  };
  handle: { current: ITradingViewEmbedHandle | null };
  mountingModule: {
    current: ILoadedTradingViewEmbed['module'] | null;
  };
  onLoadStart: { current: IWebViewProps['onLoadStart'] };
  onChartReady: { current: ITradingViewRuntimeViewProps['onChartReady'] };
  onVisualReady: { current: ITradingViewRuntimeViewProps['onVisualReady'] };
}

interface ITradingViewRuntimeContext {
  container: HTMLDivElement;
  refs: ITradingViewRuntimeRefs;
  runtimeUrl: string;
  setFallback(fallback: boolean): void;
  setVisualReady(visualReady: boolean): void;
}

interface ITradingViewRuntimeLifecycle {
  cancelled: boolean;
  failed: boolean;
  ready: boolean;
  startupTimeout: ReturnType<typeof setTimeout> | undefined;
  visualReady: boolean;
  monitor: ReturnType<typeof createTradingViewEmbedReadyMonitor>;
}

function createLoadStartEvent(url: string): WebViewNavigationEvent {
  return {
    nativeEvent: {
      canGoBack: false,
      canGoForward: false,
      loading: true,
      target: 0,
      title: '',
      url,
    },
  } as unknown as WebViewNavigationEvent;
}

function clearMountedTradingViewRuntime(refs: ITradingViewRuntimeRefs): void {
  refs.handle.current?.unmount();
  refs.handle.current = null;
  refs.mountingModule.current = null;
}

function clearTradingViewStartupTimeout(
  lifecycle: ITradingViewRuntimeLifecycle,
): void {
  if (lifecycle.startupTimeout) {
    clearTimeout(lifecycle.startupTimeout);
    lifecycle.startupTimeout = undefined;
  }
}

function switchToIframeFallback(
  context: ITradingViewRuntimeContext,
  lifecycle: ITradingViewRuntimeLifecycle,
  error: unknown,
): void {
  if (lifecycle.failed) {
    return;
  }
  lifecycle.failed = true;
  clearTradingViewStartupTimeout(lifecycle);
  lifecycle.monitor.cancel();
  if (lifecycle.cancelled) {
    return;
  }
  clearMountedTradingViewRuntime(context.refs);
  defaultLogger.app.error.log(
    `[TradingViewRuntimeView] DOM runtime failed, using iframe: ${String(
      error,
    )}`,
  );
  context.setFallback(true);
}

function forwardTradingViewEmbedMessage(
  payload: unknown,
  context: ITradingViewRuntimeContext,
  lifecycle: ITradingViewRuntimeLifecycle,
): void {
  if (!lifecycle.ready && isTradingViewChartReadyPayload(payload)) {
    lifecycle.ready = true;
    context.refs.onChartReady.current?.();
  }
  if (!lifecycle.visualReady && isTradingViewVisualReadyPayload(payload)) {
    lifecycle.visualReady = true;
    clearTradingViewStartupTimeout(lifecycle);
    context.setVisualReady(true);
    context.refs.onVisualReady.current?.();
  }
  lifecycle.monitor.notify(payload);
  void Promise.resolve(
    context.refs.customReceiveHandler.current?.({ data: payload }),
  ).catch((error: unknown) => {
    defaultLogger.app.error.log(
      `[TradingViewRuntimeView] Message handling failed: ${String(error)}`,
    );
  });
}

async function mountLoadedTradingViewEmbed(
  loaded: ILoadedTradingViewEmbed,
  context: ITradingViewRuntimeContext,
  lifecycle: ITradingViewRuntimeLifecycle,
): Promise<void> {
  if (lifecycle.cancelled || lifecycle.failed) {
    return;
  }
  const { assetBaseUrl, module } = loaded;
  const url = new URL(context.runtimeUrl, globalThis.location.href);
  context.refs.mountingModule.current = module;
  const handle = await module.mountTradingView({
    assetBaseUrl,
    container: context.container,
    onMessage: (payload) =>
      forwardTradingViewEmbedMessage(payload, context, lifecycle),
    params: url.searchParams,
  });
  if (lifecycle.cancelled || lifecycle.failed) {
    handle.unmount();
    return;
  }
  context.refs.handle.current = handle;
  context.refs.mountingModule.current = null;
}

async function loadAndMountTradingViewEmbed(
  context: ITradingViewRuntimeContext,
  lifecycle: ITradingViewRuntimeLifecycle,
): Promise<void> {
  try {
    await migrateLegacyTradingViewStorage(context.runtimeUrl);
  } catch (error) {
    defaultLogger.app.error.log(
      `[TradingViewRuntimeView] Legacy storage migration failed: ${String(
        error,
      )}`,
    );
  }
  if (lifecycle.cancelled || lifecycle.failed) {
    return;
  }
  const loaded = await loadTradingViewEmbedModule(context.runtimeUrl);
  await mountLoadedTradingViewEmbed(loaded, context, lifecycle);
}

function stopTradingViewRuntime(
  context: ITradingViewRuntimeContext,
  lifecycle: ITradingViewRuntimeLifecycle,
): void {
  lifecycle.cancelled = true;
  lifecycle.failed = true;
  clearTradingViewStartupTimeout(lifecycle);
  lifecycle.monitor.cancel();
  clearMountedTradingViewRuntime(context.refs);
}

function startTradingViewRuntime(
  context: ITradingViewRuntimeContext,
): () => void {
  const lifecycle: ITradingViewRuntimeLifecycle = {
    cancelled: false,
    failed: false,
    ready: false,
    startupTimeout: undefined,
    visualReady: false,
    monitor: createTradingViewEmbedReadyMonitor(),
  };
  const handleFailure = (error: unknown) =>
    switchToIframeFallback(context, lifecycle, error);
  lifecycle.startupTimeout = setTimeout(() => {
    handleFailure(
      new OneKeyLocalError('TradingView embed visual startup timed out'),
    );
  }, TRADING_VIEW_EMBED_STARTUP_TIMEOUT_MS);
  context.refs.onLoadStart.current?.(createLoadStartEvent(context.runtimeUrl));
  // Chart readiness includes the first data request, so only explicit chart
  // errors should trigger fallback while the embed module is mounting.
  void lifecycle.monitor.wait().catch(handleFailure);
  void loadAndMountTradingViewEmbed(context, lifecycle).catch(handleFailure);
  return () => stopTradingViewRuntime(context, lifecycle);
}

export function TradingViewRuntimeView({
  src = '',
  containerProps,
  customReceiveHandler,
  onChartError,
  onChartReady,
  onVisualReady,
  onLoadStart,
  onWebViewRef,
  ...fallbackProps
}: ITradingViewRuntimeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ITradingViewEmbedHandle | null>(null);
  const mountingModuleRef = useRef<
    Awaited<ReturnType<typeof loadTradingViewEmbedModule>>['module'] | null
  >(null);
  const customReceiveHandlerRef = useRef(customReceiveHandler);
  const onChartErrorRef = useRef(onChartError);
  const onChartReadyRef = useRef(onChartReady);
  const onVisualReadyRef = useRef(onVisualReady);
  const onLoadStartRef = useRef(onLoadStart);
  const fallbackWebViewRef = useRef<IWebViewRef | null>(null);
  const [fallback, setFallback] = useState(false);
  const [visualReady, setVisualReady] = useState(false);
  const [runtimeUrl, setRuntimeUrl] = useState(src);
  const [reloadRevision, setReloadRevision] = useState(0);

  customReceiveHandlerRef.current = customReceiveHandler;
  onChartErrorRef.current = onChartError;
  onChartReadyRef.current = onChartReady;
  onVisualReadyRef.current = onVisualReady;
  onLoadStartRef.current = onLoadStart;

  const webViewRef = useMemo<IWebViewRef>(
    () =>
      ({
        loadURL(url: string) {
          setVisualReady(false);
          setRuntimeUrl(url);
        },
        reload() {
          setVisualReady(false);
          setReloadRevision((revision) => revision + 1);
        },
        sendMessageViaInjectedScript(message: unknown) {
          if (handleRef.current) {
            handleRef.current.postMessage(message);
            return;
          }
          mountingModuleRef.current?.postTradingViewMessage(message);
        },
      }) as IWebViewRef,
    [],
  );

  const handleFallbackWebViewRef = useCallback(
    (ref: IWebViewRef | null) => {
      fallbackWebViewRef.current = ref;
      if (fallback) {
        onWebViewRef?.(ref);
      }
    },
    [fallback, onWebViewRef],
  );

  useEffect(() => {
    setVisualReady(false);
    setRuntimeUrl(src);
  }, [src]);

  useLayoutEffect(() => {
    onWebViewRef?.(fallback ? fallbackWebViewRef.current : webViewRef);
    return () => onWebViewRef?.(null);
  }, [fallback, onWebViewRef, webViewRef]);

  useLayoutEffect(
    () => () => {
      handleRef.current?.unmount();
      handleRef.current = null;
      mountingModuleRef.current = null;
    },
    [],
  );

  useEffect(() => {
    setFallback(false);
    setVisualReady(false);
  }, [reloadRevision, runtimeUrl]);

  useEffect(() => {
    if (fallback) {
      onChartErrorRef.current?.();
    }
  }, [fallback]);

  useEffect(() => {
    if (fallback) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container || !runtimeUrl) {
      return undefined;
    }
    return startTradingViewRuntime({
      container,
      refs: {
        customReceiveHandler: customReceiveHandlerRef,
        handle: handleRef,
        mountingModule: mountingModuleRef,
        onChartReady: onChartReadyRef,
        onVisualReady: onVisualReadyRef,
        onLoadStart: onLoadStartRef,
      },
      runtimeUrl,
      setFallback,
      setVisualReady,
    });
  }, [fallback, reloadRevision, runtimeUrl]);

  if (fallback) {
    return (
      <WebView
        {...fallbackProps}
        containerProps={containerProps}
        customReceiveHandler={customReceiveHandler}
        onLoadStart={onLoadStart}
        onWebViewRef={handleFallbackWebViewRef}
        src={runtimeUrl}
      />
    );
  }

  return (
    <Stack flex={1} bg="$bgApp" {...containerProps}>
      <div
        ref={containerRef}
        data-testid="trading-view-dom-runtime"
        style={{
          height: '100%',
          visibility: visualReady ? 'visible' : 'hidden',
          width: '100%',
        }}
      />
    </Stack>
  );
}
