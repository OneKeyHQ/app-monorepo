/** @jest-environment jsdom */

import { act, render, screen, waitFor } from '@testing-library/react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import { createTradingViewEmbedReadyMonitor } from './tradingViewEmbedReady.web';
import TradingViewRuntimeView from './TradingViewRuntimeView.web-only';

const webViewProps = jest.fn();
const mockFallbackSendMessage = jest.fn();
const mockFallbackWebViewRef = {
  loadURL: jest.fn(),
  reload: jest.fn(),
  sendMessageViaInjectedScript: mockFallbackSendMessage,
} as IWebViewRef;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

jest.mock('@onekeyhq/kit/src/components/WebView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockWebView(props: Record<string, unknown>) {
    webViewProps(props);
    const onWebViewRef = props.onWebViewRef as
      | ((ref: IWebViewRef | null) => void)
      | undefined;
    React.useLayoutEffect(() => {
      onWebViewRef?.(mockFallbackWebViewRef);
      return () => onWebViewRef?.(null);
    }, [onWebViewRef]);
    return React.createElement('div', { 'data-testid': 'fallback-webview' });
  }
  return {
    __esModule: true,
    default: MockWebView,
  };
});

jest.mock('./tradingViewEmbedLoader.web', () => ({
  loadTradingViewEmbedModule: jest.fn(),
}));

jest.mock('./tradingViewEmbedReady.web', () => ({
  createTradingViewEmbedReadyMonitor: jest.fn(() => ({
    cancel: jest.fn(),
    notify: jest.fn(),
    wait: jest.fn(() => Promise.resolve()),
  })),
}));

describe('TradingViewRuntimeView web fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.sessionStorage.clear();
    jest
      .mocked(loadTradingViewEmbedModule)
      .mockRejectedValue(new Error('embed unavailable'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the legacy iframe background bridge enabled', async () => {
    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    expect(webViewProps.mock.lastCall?.[0]).not.toHaveProperty(
      'skipBackgroundBridge',
    );
  });

  it('switches message delivery to the iframe after the embed fails', async () => {
    const runtimeRef: { current: IWebViewRef | null } = { current: null };
    render(
      <TradingViewRuntimeView
        src="https://tradingview.onekeytest.com"
        onWebViewRef={(ref) => {
          runtimeRef.current = ref;
        }}
      />,
    );

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    await waitFor(() => {
      expect(runtimeRef.current).toBe(mockFallbackWebViewRef);
    });

    const message = { type: 'autoKLineUpdate' };
    runtimeRef.current?.sendMessageViaInjectedScript(message);
    expect(mockFallbackSendMessage).toHaveBeenCalledWith(message);
  });

  it('keeps the iframe message channel after a previous embed failure', async () => {
    const runtimeUrl = 'https://tradingview.onekeytest.com';
    const runtimeRef: { current: IWebViewRef | null } = { current: null };
    globalThis.sessionStorage.setItem(
      'onekey_tradingview_embed_failed:https://tradingview.onekeytest.com',
      '1',
    );

    render(
      <TradingViewRuntimeView
        src={runtimeUrl}
        onWebViewRef={(ref) => {
          runtimeRef.current = ref;
        }}
      />,
    );

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    await waitFor(() => {
      expect(runtimeRef.current).toBe(mockFallbackWebViewRef);
    });

    const message = { type: 'kLineData' };
    runtimeRef.current?.sendMessageViaInjectedScript(message);
    expect(mockFallbackSendMessage).toHaveBeenCalledWith(message);
    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
  });

  it('mounts the module as soon as it is available', async () => {
    let resolveModule:
      | ((
          value: Awaited<ReturnType<typeof loadTradingViewEmbedModule>>,
        ) => void)
      | undefined;
    const mountTradingView = jest.fn(() =>
      Promise.resolve({ postMessage: jest.fn(), unmount: jest.fn() }),
    );
    const postTradingViewMessage = jest.fn(() => true);
    jest.mocked(loadTradingViewEmbedModule).mockReturnValue(
      new Promise((resolve) => {
        resolveModule = resolve;
      }) as ReturnType<typeof loadTradingViewEmbedModule>,
    );
    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    await waitFor(() => {
      expect(loadTradingViewEmbedModule).toHaveBeenCalledTimes(1);
    });
    resolveModule?.({
      assetBaseUrl: 'https://app-bundle.onekeytest.com/tv/',
      module: { mountTradingView, postTradingViewMessage },
    });
    await waitFor(() => expect(mountTradingView).toHaveBeenCalledTimes(1));
    expect(createTradingViewEmbedReadyMonitor).toHaveBeenCalledTimes(1);
  });

  it('forwards chart responses while the embed mount is pending', async () => {
    let resolveMount:
      | ((value: {
          postMessage(message: unknown): void;
          unmount(): void;
        }) => void)
      | undefined;
    const runtimeRef: { current: IWebViewRef | null } = { current: null };
    const postMessage = jest.fn();
    const unmount = jest.fn();
    const mountTradingView = jest.fn(
      () =>
        new Promise<{
          postMessage(message: unknown): void;
          unmount(): void;
        }>((resolve) => {
          resolveMount = resolve;
        }),
    );
    const postTradingViewMessage = jest.fn(() => true);
    jest.mocked(loadTradingViewEmbedModule).mockResolvedValue({
      assetBaseUrl: 'https://app-bundle.onekeytest.com/tv/',
      module: { mountTradingView, postTradingViewMessage },
    });

    render(
      <TradingViewRuntimeView
        src="https://tradingview.onekeytest.com"
        onWebViewRef={(ref) => {
          runtimeRef.current = ref;
        }}
      />,
    );

    await waitFor(() => expect(mountTradingView).toHaveBeenCalledTimes(1));
    expect(runtimeRef.current).not.toBeNull();
    runtimeRef.current?.sendMessageViaInjectedScript({ type: 'kLineData' });
    expect(postTradingViewMessage).toHaveBeenCalledWith({ type: 'kLineData' });

    resolveMount?.({ postMessage, unmount });
    await waitFor(() =>
      expect(postTradingViewMessage).toHaveBeenCalledTimes(1),
    );
    runtimeRef.current?.sendMessageViaInjectedScript({
      type: 'autoKLineUpdate',
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'autoKLineUpdate' });
  });

  it('falls back when readiness fails before module loading finishes', async () => {
    let rejectReady: ((error: Error) => void) | undefined;
    jest.mocked(createTradingViewEmbedReadyMonitor).mockReturnValueOnce({
      cancel: jest.fn(),
      notify: jest.fn(),
      wait: jest.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectReady = reject;
          }),
      ),
    });
    jest
      .mocked(loadTradingViewEmbedModule)
      .mockReturnValue(
        new Promise(() => undefined) as ReturnType<
          typeof loadTradingViewEmbedModule
        >,
      );

    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    await waitFor(() => expect(loadTradingViewEmbedModule).toHaveBeenCalled());
    rejectReady?.(new Error('embed startup timed out'));

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
  });

  it('does not fall back merely because chart readiness is still pending', async () => {
    let resolveReady: (() => void) | undefined;
    const wait = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReady = resolve;
        }),
    );
    jest.mocked(createTradingViewEmbedReadyMonitor).mockReturnValueOnce({
      cancel: jest.fn(),
      notify: jest.fn(),
      wait,
    });
    jest.mocked(loadTradingViewEmbedModule).mockResolvedValue({
      assetBaseUrl: 'https://app-bundle.onekeytest.com/tv/',
      module: {
        mountTradingView: jest.fn(() =>
          Promise.resolve({ postMessage: jest.fn(), unmount: jest.fn() }),
        ),
        postTradingViewMessage: jest.fn(() => true),
      },
    });

    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    await waitFor(() => expect(wait).toHaveBeenCalledWith());
    expect(screen.queryByTestId('fallback-webview')).toBeNull();

    resolveReady?.();
  });

  it('keeps waiting for the embed module instead of falling back to iframe', async () => {
    jest.useFakeTimers();
    const runtimeUrl = 'https://tradingview.onekeytest.com';
    let resolveModule:
      | ((
          value: Awaited<ReturnType<typeof loadTradingViewEmbedModule>>,
        ) => void)
      | undefined;
    const mountTradingView = jest.fn(() =>
      Promise.resolve({ postMessage: jest.fn(), unmount: jest.fn() }),
    );
    const modulePromise = new Promise<
      Awaited<ReturnType<typeof loadTradingViewEmbedModule>>
    >((resolve) => {
      resolveModule = resolve;
    });
    jest.mocked(loadTradingViewEmbedModule).mockReturnValue(modulePromise);

    const firstView = render(<TradingViewRuntimeView src={runtimeUrl} />);

    expect(loadTradingViewEmbedModule).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(screen.queryByTestId('fallback-webview')).toBeNull();
    expect(
      globalThis.sessionStorage.getItem(
        'onekey_tradingview_embed_failed:https://tradingview.onekeytest.com',
      ),
    ).toBeNull();

    await act(async () => {
      resolveModule?.({
        assetBaseUrl: 'https://app-bundle.onekeytest.com/tv/',
        module: {
          mountTradingView,
          postTradingViewMessage: jest.fn(() => true),
        },
      });
      await modulePromise;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mountTradingView).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('fallback-webview')).toBeNull();
    firstView.unmount();
  });

  it('remembers an explicit embed failure for the current session', async () => {
    const runtimeUrl = 'https://tradingview.onekeytest.com';
    const firstView = render(<TradingViewRuntimeView src={runtimeUrl} />);

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    firstView.unmount();
    jest.mocked(loadTradingViewEmbedModule).mockClear();

    render(<TradingViewRuntimeView src={runtimeUrl} />);

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
  });
});
