/** @jest-environment jsdom */

import { act, cleanup, render } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv, { ERuntimeRole } from '@onekeyhq/shared/src/platformEnv';

import { WebViewWebEmbedProvider } from './WebViewWebEmbedProvider';

const mockIsWebEmbedApiReady = jest.fn<Promise<boolean>, []>();
const mockWebViewMount = jest.fn();
const mockWebViewUnmount = jest.fn();

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      serviceDApp: {
        isWebEmbedApiReady: () => mockIsWebEmbedApiReady(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  return {
    ERuntimeRole: {
      Main: 'main',
      Background: 'background',
      Standalone: 'standalone',
    },
    default: {
      isNative: true,
      isJest: true,
      runtimeRole: 'main',
    },
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      webembed: {
        webEmbedWaitRemoteApiReady: jest.fn(),
        initTimeout: jest.fn(),
        loadWebEmbedWebViewComplete: jest.fn(),
        emitRenderEvent: jest.fn(),
        showWebEmbedWebView: jest.fn(),
        webEmbedProviderEventReceived: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/imageUtils.embedBridge', () => ({
  registerImageEmbedBridge: jest.fn(),
}));

jest.mock('../components/WebViewWebEmbed', () => ({
  WebViewWebEmbedSingleton: () => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      mockWebViewMount();
      return () => {
        mockWebViewUnmount();
      };
    }, []);
    return null;
  },
}));

describe('WebEmbed API startup request', () => {
  let backgroundProxy: typeof import('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy').default;
  let backgroundBus: typeof appEventBus;
  let backgroundEmitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsWebEmbedApiReady.mockResolvedValue(false);
    platformEnv.runtimeRole = ERuntimeRole.Main;
    jest.isolateModules(() => {
      backgroundBus = require('@onekeyhq/shared/src/eventBus/appEventBus')
        .appEventBus as typeof appEventBus;
      backgroundProxy =
        require('@onekeyhq/kit-bg/src/webembeds/instance/webembedApiProxy')
          .default as typeof backgroundProxy;
    });
    const emitInMain = appEventBus.emit.bind(appEventBus);
    jest.spyOn(appEventBus, 'emit').mockImplementation((type, payload) => {
      const emitted = emitInMain(type, payload);
      backgroundBus.dispatchInboundFromForeground({
        type,
        payload,
        originNodeId: appEventBus.nodeId,
      });
      return emitted;
    });
    const emitInBackground = backgroundBus.emit.bind(backgroundBus);
    backgroundEmitSpy = jest
      .spyOn(backgroundBus, 'emit')
      .mockImplementation((type, payload) => {
        const emitted = emitInBackground(type, payload);
        appEventBus.dispatchInboundFromBackground({
          type,
          payload,
          originNodeId: backgroundBus.nodeId,
        });
        return emitted;
      });
  });

  afterEach(() => {
    cleanup();
    appEventBus.removeAllListeners(EAppEventBusNames.LoadWebEmbedWebView);
    appEventBus.removeAllListeners(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
    );
    backgroundBus.removeAllListeners(EAppEventBusNames.LoadWebEmbedWebView);
    backgroundBus.removeAllListeners(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
    );
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the WebView when a request arrives before the provider subscribes', async () => {
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });

    expect(mockWebViewMount).not.toHaveBeenCalled();
    render(<WebViewWebEmbedProvider />);

    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    expect(mockWebViewUnmount).not.toHaveBeenCalled();
    const loadCalls = backgroundEmitSpy.mock.calls.filter(
      ([type]) => type === EAppEventBusNames.LoadWebEmbedWebView,
    );
    expect(loadCalls).toHaveLength(2);
    expect(loadCalls[0]?.[1]).toEqual(loadCalls[1]?.[1]);
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await pending;
  });

  it('renders and completes when the provider subscribes before a request', async () => {
    render(<WebViewWebEmbedProvider />);

    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });

    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    expect(mockWebViewUnmount).not.toHaveBeenCalled();
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await pending;
  });

  it('does not remount the WebView for concurrent requests', async () => {
    render(<WebViewWebEmbedProvider />);

    let first: Promise<void> | undefined;
    await act(async () => {
      first = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 1);
    let second: Promise<void> | undefined;
    await act(async () => {
      second = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });

    const initialLoadCalls = backgroundEmitSpy.mock.calls.filter(
      ([type]) => type === EAppEventBusNames.LoadWebEmbedWebView,
    );
    expect(initialLoadCalls).toHaveLength(1);
    act(() => {
      appEventBus.emit(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
        undefined,
      );
    });
    const retriedLoadCalls = backgroundEmitSpy.mock.calls.filter(
      ([type]) => type === EAppEventBusNames.LoadWebEmbedWebView,
    );
    expect(retriedLoadCalls).toHaveLength(2);
    expect(retriedLoadCalls[1]?.[1]).toEqual(initialLoadCalls[0]?.[1]);
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    expect(mockWebViewUnmount).not.toHaveBeenCalled();
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await Promise.all([first, second]);
  });

  it('removes the completion listener after timeout so a retry can succeed', async () => {
    render(<WebViewWebEmbedProvider />);
    const baseline = backgroundBus.listenerCount(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
    );
    const providerReadyBaseline = backgroundBus.listenerCount(
      EAppEventBusNames.WebEmbedWebViewProviderReady,
    );

    const first = backgroundProxy.waitRemoteApiReady();
    void first.catch(() => {});
    await act(async () => {
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(40_000);
    });

    await expect(first).rejects.toThrow('WebEmbedApi not ready after 40s.');
    expect(globalThis.$onekeyAppWebembedApiWebviewInitFailed).toBe(true);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
      ),
    ).toBe(baseline);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
      ),
    ).toBe(providerReadyBaseline);

    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    expect(globalThis.$onekeyAppWebembedApiWebviewInitFailed).toBe(false);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
      ),
    ).toBe(baseline);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
      ),
    ).toBe(providerReadyBaseline);

    let retry: Promise<void> | undefined;
    await act(async () => {
      retry = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await retry;
    expect(mockWebViewMount).toHaveBeenCalledTimes(2);
    expect(mockWebViewUnmount).toHaveBeenCalledTimes(1);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
      ),
    ).toBe(baseline);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
      ),
    ).toBe(providerReadyBaseline);
  });

  it('cleans up a failed ready query and allows the next request to succeed', async () => {
    render(<WebViewWebEmbedProvider />);
    const queryError = new Error('ready query failed');
    mockIsWebEmbedApiReady.mockRejectedValueOnce(queryError);
    const completeBaseline = backgroundBus.listenerCount(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
    );
    const providerReadyBaseline = backgroundBus.listenerCount(
      EAppEventBusNames.WebEmbedWebViewProviderReady,
    );

    await expect(backgroundProxy.waitRemoteApiReady()).rejects.toBe(queryError);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
      ),
    ).toBe(completeBaseline);
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.WebEmbedWebViewProviderReady,
      ),
    ).toBe(providerReadyBaseline);

    let retry: Promise<void> | undefined;
    await act(async () => {
      retry = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });
    expect(mockIsWebEmbedApiReady).toHaveBeenCalledTimes(2);
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await retry;
  });

  it('does not request a WebView when the SDK is already ready', async () => {
    mockIsWebEmbedApiReady.mockResolvedValue(true);
    render(<WebViewWebEmbedProvider />);

    await backgroundProxy.waitRemoteApiReady();

    expect(mockWebViewMount).not.toHaveBeenCalled();
    const loadCalls = backgroundEmitSpy.mock.calls.filter(
      ([type]) => type === EAppEventBusNames.LoadWebEmbedWebView,
    );
    expect(loadCalls).toHaveLength(0);
  });

  it('does not mount a WebView just because the provider subscribes', () => {
    render(<WebViewWebEmbedProvider />);

    expect(mockWebViewMount).not.toHaveBeenCalled();
    expect(mockIsWebEmbedApiReady).not.toHaveBeenCalled();
  });

  it('settles a completion emitted during the ready query without a stale pending attempt', async () => {
    render(<WebViewWebEmbedProvider />);
    mockIsWebEmbedApiReady.mockImplementationOnce(() => {
      backgroundBus.emit(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
        undefined,
      );
      return Promise.resolve(false);
    });

    await backgroundProxy.waitRemoteApiReady();
    expect(mockWebViewMount).not.toHaveBeenCalled();
    expect(
      backgroundBus.listenerCount(
        EAppEventBusNames.LoadWebEmbedWebViewComplete,
      ),
    ).toBe(1);

    let retry: Promise<void> | undefined;
    await act(async () => {
      retry = backgroundProxy.waitRemoteApiReady();
      await Promise.resolve();
    });
    expect(mockIsWebEmbedApiReady).toHaveBeenCalledTimes(2);
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);
    backgroundBus.emit(
      EAppEventBusNames.LoadWebEmbedWebViewComplete,
      undefined,
    );
    await retry;
  });

  it('preserves rebuilds for legacy Load events without request IDs', () => {
    render(<WebViewWebEmbedProvider />);

    act(() => {
      appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
    });
    expect(mockWebViewMount).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 1);
    act(() => {
      appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, undefined);
    });
    expect(mockWebViewMount).toHaveBeenCalledTimes(2);
    expect(mockWebViewUnmount).toHaveBeenCalledTimes(1);
  });
});
