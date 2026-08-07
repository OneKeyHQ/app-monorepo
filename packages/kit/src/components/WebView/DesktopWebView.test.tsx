/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
  CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
  CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
  CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL,
} from './customInjectionChannels';
import { DesktopWebView } from './DesktopWebView';

let mockDevSettingsEnabled = false;
let mockShowWebviewDevTools = false;
let mockCustomInjectionEnabled = false;
let mockGeneratedUUID = 'test-capability-token-1234';

jest.mock('@onekeyfe/cross-inpage-provider-core', () => ({
  consts: {
    JS_BRIDGE_MESSAGE_IPC_CHANNEL: 'onekey-js-bridge',
  },
}));

jest.mock('@onekeyfe/onekey-cross-webview', () => ({
  JsBridgeDesktopHost: class MockJsBridgeDesktopHost {
    globalOnMessageEnabled = false;

    webviewWrapper: unknown;
  },
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    connectBridge: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: mockDevSettingsEnabled,
      settings: {
        customInjection: {
          enabled: mockCustomInjectionEnabled,
        },
        showWebviewDevTools: mockShowWebviewDevTools,
      },
    },
  ],
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Icon: ({ name }: { name: string }) =>
      React.createElement('span', { 'data-icon': name }),
    useTheme: () => ({
      bgAccent: { val: '#00b812' },
      bgAccentActive: { val: '#008f0e' },
      bgBackdrop: { val: 'rgba(0, 0, 0, 0.4)' },
      iconOnColor: { val: '#ffffff' },
    }),
    Stack: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('div', props, children),
  };
});

jest.mock('@onekeyhq/shared/src/background/backgroundUtils', () => ({
  waitForDataLoaded: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/stringUtils', () => ({
  __esModule: true,
  default: {
    generateUUID: () => mockGeneratedUUID,
  },
}));

jest.mock('./ErrorView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ onRefresh }: { onRefresh: () => void }) =>
      // eslint-disable-next-line react/button-has-type
      React.createElement(
        'button',
        {
          'data-testid': 'desktop-webview-error',
          'onClick': onRefresh,
          'type': 'button',
        },
        'retry',
      ),
  };
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('DesktopWebView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevSettingsEnabled = false;
    mockShowWebviewDevTools = false;
    mockCustomInjectionEnabled = false;
    mockGeneratedUUID = 'test-capability-token-1234';
  });

  it('recovers all mounted webviews after one preload retry succeeds', async () => {
    const preload = createDeferred<string>();
    const getPreloadJsContent = jest
      .fn()
      .mockRejectedValueOnce(new Error('preload failed'))
      .mockReturnValueOnce(preload.promise);
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent,
        },
      },
    });

    render(
      <>
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
        />
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
        />
      </>,
    );

    expect(screen.queryByTestId('desktop-webview')).toBeNull();

    await waitFor(() =>
      expect(screen.getAllByTestId('desktop-webview-error')).toHaveLength(2),
    );

    fireEvent.click(screen.getAllByTestId('desktop-webview-error')[0]);

    await waitFor(() => expect(getPreloadJsContent).toHaveBeenCalledTimes(2));

    await act(async () => {
      preload.resolve('file:///tmp/preload.js');
      await preload.promise;
    });

    await waitFor(() =>
      expect(screen.getAllByTestId('desktop-webview')).toHaveLength(2),
    );

    expect(screen.queryByTestId('desktop-webview-error')).toBeNull();
    expect(
      screen
        .getAllByTestId('desktop-webview')
        .every(
          (webview) =>
            webview.getAttribute('preload') === 'file:///tmp/preload.js',
        ),
    ).toBe(true);
    expect(getPreloadJsContent).toHaveBeenCalledTimes(2);
  });

  it('uses a confirmed custom preload without loading the built-in preload', async () => {
    mockDevSettingsEnabled = true;
    mockCustomInjectionEnabled = true;
    const getPreloadJsContent = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent,
        },
      },
    });

    render(
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src="https://app.uniswap.org"
        receiveHandler={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('desktop-webview').getAttribute('preload'),
      ).toBe('file:///workspace/injectedDesktopPreload.js?sha256=abc'),
    );
    expect(getPreloadJsContent).not.toHaveBeenCalled();
  });

  it('ignores a custom preload while Developer Settings is disabled', async () => {
    const customPreload =
      'file:///workspace/injectedDesktopPreload.js?sha256=blocked';
    const getPreloadJsContent = jest
      .fn()
      .mockResolvedValue('file:///tmp/built-in-preload.js');
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent,
        },
      },
    });

    render(
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl={customPreload}
        src="https://app.uniswap.org"
        receiveHandler={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('desktop-webview')).toBeTruthy(),
    );
    expect(
      screen.getByTestId('desktop-webview').getAttribute('preload'),
    ).not.toBe(customPreload);
  });

  it('ignores a custom preload while Custom Injection is disabled', async () => {
    mockDevSettingsEnabled = true;
    const customPreload =
      'file:///workspace/injectedDesktopPreload.js?sha256=blocked';
    const getPreloadJsContent = jest
      .fn()
      .mockResolvedValue('file:///tmp/built-in-preload.js');
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent,
        },
      },
    });

    render(
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl={customPreload}
        src="https://app.uniswap.org"
        receiveHandler={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('desktop-webview')).toBeTruthy(),
    );
    expect(
      screen.getByTestId('desktop-webview').getAttribute('preload'),
    ).not.toBe(customPreload);
  });

  it('accepts repository wallet markers only with both developer switches and the isolated preload token', async () => {
    mockDevSettingsEnabled = true;
    mockCustomInjectionEnabled = true;
    const onCustomInjectionAutoReview = jest.fn();
    const getPreloadJsContent = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent,
        },
      },
    });

    const renderWebView = (
      autoReviewHandler: typeof onCustomInjectionAutoReview | undefined,
    ) => (
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src="https://app.uniswap.org/swap"
        receiveHandler={jest.fn()}
        onCustomInjectionAutoReview={autoReviewHandler}
      />
    );
    const { rerender } = render(renderWebView(onCustomInjectionAutoReview));

    const webview = await screen.findByTestId('desktop-webview');
    const send = jest.fn().mockResolvedValue(undefined);
    Object.defineProperties(webview, {
      getURL: {
        configurable: true,
        value: () => 'https://app.uniswap.org/swap',
      },
      getWebContentsId: {
        configurable: true,
        value: () => 42,
      },
      send: {
        configurable: true,
        value: send,
      },
    });
    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
        {
          version: 1,
          token: 'test-capability-token-1234',
        },
      ),
    );
    const detection = {
      version: 1,
      detection: {
        iconKey: 'onekey',
        iconLabel: 'OneKey',
        sourceKind: 'asset',
      },
    };
    const walletIdDetection = {
      version: 1,
      detection: {
        iconKey: 'onekey',
        iconLabel: 'OneKey',
        sourceKind: 'wallet-id',
        walletId: 'ethereum-onekey-wallet',
      },
    };
    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [{ ...detection, token: 'forged-page-token-1234' }],
      }),
    );
    expect(onCustomInjectionAutoReview).not.toHaveBeenCalled();

    const authenticatedEvent = Object.assign(new Event('ipc-message'), {
      channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
      args: [
        {
          ...walletIdDetection,
          token: 'test-capability-token-1234',
        },
      ],
    });
    fireEvent(webview, authenticatedEvent);
    expect(onCustomInjectionAutoReview).toHaveBeenCalledWith({
      iconKey: 'onekey',
      iconLabel: 'OneKey',
      sourceKind: 'wallet-id',
      walletId: 'ethereum-onekey-wallet',
      pageUrl: 'https://app.uniswap.org/swap',
      webContentsId: 42,
    });

    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [
          {
            ...detection,
            token: 'test-capability-token-1234',
          },
        ],
      }),
    );
    expect(onCustomInjectionAutoReview).toHaveBeenCalledTimes(1);

    const replacementAutoReviewHandler = jest.fn();
    mockGeneratedUUID = 'replacement-capability-token-5678';
    rerender(renderWebView(replacementAutoReviewHandler));
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
        {
          version: 1,
          token: 'replacement-capability-token-5678',
        },
      ),
    );
    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [
          {
            ...detection,
            token: 'replacement-capability-token-5678',
          },
        ],
      }),
    );
    expect(replacementAutoReviewHandler).toHaveBeenCalledTimes(1);

    rerender(renderWebView(undefined));
    mockGeneratedUUID = 'second-capability-token-9012';
    rerender(renderWebView(onCustomInjectionAutoReview));
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
        {
          version: 1,
          token: 'second-capability-token-9012',
        },
      ),
    );
    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [
          {
            ...detection,
            token: 'second-capability-token-9012',
          },
        ],
      }),
    );
    expect(onCustomInjectionAutoReview).toHaveBeenCalledTimes(2);
  });

  it('does not carry an auto-review detection across protocol navigation', async () => {
    mockDevSettingsEnabled = true;
    mockCustomInjectionEnabled = true;
    const oldProtocolAutoReview = jest.fn();
    const nextProtocolAutoReview = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent: jest.fn(),
        },
      },
    });

    const renderWebView = (
      src: string,
      onCustomInjectionAutoReview: typeof oldProtocolAutoReview,
    ) => (
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src={src}
        receiveHandler={jest.fn()}
        onCustomInjectionAutoReview={onCustomInjectionAutoReview}
      />
    );
    const { rerender } = render(
      renderWebView('https://old-protocol.example', oldProtocolAutoReview),
    );
    const webview = await screen.findByTestId('desktop-webview');
    let currentUrl = 'https://old-protocol.example';
    const send = jest.fn().mockResolvedValue(undefined);
    Object.defineProperties(webview, {
      getURL: {
        configurable: true,
        value: () => currentUrl,
      },
      getWebContentsId: {
        configurable: true,
        value: () => 42,
      },
      send: {
        configurable: true,
        value: send,
      },
    });
    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
        {
          version: 1,
          token: 'test-capability-token-1234',
        },
      ),
    );

    mockGeneratedUUID = 'next-protocol-token-5678';
    rerender(
      renderWebView('https://next-protocol.example', nextProtocolAutoReview),
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [
          {
            version: 1,
            token: 'test-capability-token-1234',
            detection: {
              iconKey: 'onekey',
              iconLabel: 'OneKey',
              sourceKind: 'asset',
            },
          },
        ],
      }),
    );
    expect(nextProtocolAutoReview).not.toHaveBeenCalled();

    fireEvent(
      webview,
      Object.assign(new Event('did-start-navigation'), {
        isInPlace: false,
        isMainFrame: true,
        url: 'https://next-protocol.example',
      }),
    );
    currentUrl = 'https://next-protocol.example';
    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
        {
          version: 1,
          token: 'next-protocol-token-5678',
        },
      ),
    );

    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
        args: [
          {
            version: 1,
            token: 'next-protocol-token-5678',
            detection: {
              iconKey: 'onekey',
              iconLabel: 'OneKey',
              sourceKind: 'asset',
            },
          },
        ],
      }),
    );
    expect(oldProtocolAutoReview).not.toHaveBeenCalled();
    expect(nextProtocolAutoReview).toHaveBeenCalledWith({
      iconKey: 'onekey',
      iconLabel: 'OneKey',
      sourceKind: 'asset',
      pageUrl: 'https://next-protocol.example',
      webContentsId: 42,
    });
  });

  it('does not configure automatic review while Custom Injection is disabled', async () => {
    mockDevSettingsEnabled = true;
    const onCustomInjectionAutoReview = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent: jest.fn(),
        },
      },
    });

    render(
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src="https://app.uniswap.org"
        receiveHandler={jest.fn()}
        onCustomInjectionAutoReview={onCustomInjectionAutoReview}
      />,
    );
    const webview = await screen.findByTestId('desktop-webview');
    const send = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(webview, 'send', {
      configurable: true,
      value: send,
    });
    fireEvent(webview, new Event('dom-ready'));
    expect(send).not.toHaveBeenCalled();
    expect(onCustomInjectionAutoReview).not.toHaveBeenCalled();
  });

  it('forwards only redirect targets accepted by the WebView URL guard', async () => {
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent: jest
            .fn()
            .mockResolvedValue('file:///tmp/built-in-preload.js'),
        },
      },
    });
    const onDidRedirectNavigation = jest.fn();
    const onShouldStartLoadWithRequest = jest.fn(
      ({ url }: { url: string }) => url === 'https://redirected.example/',
    );
    render(
      <DesktopWebView
        data-testid="desktop-webview"
        src="https://protocol.example"
        receiveHandler={jest.fn()}
        onDidRedirectNavigation={onDidRedirectNavigation}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      />,
    );
    const webview = await screen.findByTestId('desktop-webview');
    const stop = jest.fn();
    Object.defineProperty(webview, 'stop', {
      configurable: true,
      value: stop,
    });
    const allowedRedirect = Object.assign(
      new Event('did-redirect-navigation'),
      {
        frameProcessId: 1,
        frameRoutingId: 2,
        isInPlace: false,
        isMainFrame: true,
        url: 'https://redirected.example/',
      },
    );
    fireEvent(webview, allowedRedirect);
    expect(onDidRedirectNavigation).toHaveBeenCalledWith(allowedRedirect);
    expect(stop).not.toHaveBeenCalled();

    fireEvent(
      webview,
      Object.assign(new Event('did-redirect-navigation'), {
        frameProcessId: 1,
        frameRoutingId: 2,
        isInPlace: false,
        isMainFrame: true,
        url: 'https://blocked.example/',
      }),
    );
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onDidRedirectNavigation).toHaveBeenCalledTimes(1);
  });

  it('restarts the isolated recorder after a cross-document navigation', async () => {
    mockDevSettingsEnabled = true;
    mockCustomInjectionEnabled = true;
    const onCustomInjectionRecordingEvent = jest.fn();
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: { webview: { getPreloadJsContent: jest.fn() } },
    });
    const token = 'recording-capability-token-1234';
    const renderWebView = (action: 'start' | 'stop') => (
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src="https://app.uniswap.org/swap"
        receiveHandler={jest.fn()}
        customInjectionRecordingCommand={{ token, action }}
        onCustomInjectionRecordingEvent={onCustomInjectionRecordingEvent}
      />
    );
    const { rerender } = render(renderWebView('start'));
    const webview = await screen.findByTestId('desktop-webview');
    const send = jest.fn().mockResolvedValue(undefined);
    Object.defineProperties(webview, {
      getURL: {
        configurable: true,
        value: () => 'https://app.uniswap.org/swap',
      },
      getWebContentsId: { configurable: true, value: () => 42 },
      send: { configurable: true, value: send },
    });
    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
        { version: 1, token, action: 'start' },
      ),
    );

    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL,
        args: [
          { version: 1, token: 'forged-recording-token', status: 'started' },
        ],
      }),
    );
    expect(onCustomInjectionRecordingEvent).not.toHaveBeenCalled();

    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL,
        args: [{ version: 1, token, status: 'started' }],
      }),
    );
    expect(onCustomInjectionRecordingEvent).toHaveBeenCalledWith({
      token,
      status: 'started',
      pageUrl: 'https://app.uniswap.org/swap',
      webContentsId: 42,
    });

    fireEvent(
      webview,
      Object.assign(new Event('did-start-navigation'), {
        isInPlace: false,
        isMainFrame: true,
        url: 'https://app.uniswap.org/connect',
      }),
    );
    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenNthCalledWith(
        2,
        CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
        { version: 1, token, action: 'start' },
      ),
    );

    rerender(renderWebView('stop'));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
        { version: 1, token, action: 'stop' },
      ),
    );
    const recording = {
      schemaVersion: 1 as const,
      kind: 'onekey-connect-button-recording-capture' as const,
      startedAt: '2026-08-03T00:00:00.000Z',
      finishedAt: '2026-08-03T00:00:01.000Z',
      initialUrl: 'https://app.uniswap.org/swap',
      finalUrl: 'https://app.uniswap.org/swap',
      title: 'Uniswap',
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      steps: [],
    };
    fireEvent(
      webview,
      Object.assign(new Event('ipc-message'), {
        channel: CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL,
        args: [{ version: 1, token, status: 'completed', recording }],
      }),
    );
    expect(onCustomInjectionRecordingEvent).toHaveBeenLastCalledWith({
      token,
      status: 'completed',
      pageUrl: 'https://app.uniswap.org/swap',
      webContentsId: 42,
      recording,
    });
  });

  it('stops the recorder after a same-document navigation without another dom-ready event', async () => {
    mockDevSettingsEnabled = true;
    mockCustomInjectionEnabled = true;
    const token = 'recording-capability-token-5678';
    const renderWebView = (action: 'start' | 'stop') => (
      <DesktopWebView
        data-testid="desktop-webview"
        desktopPreloadUrl="file:///workspace/injectedDesktopPreload.js?sha256=abc"
        src="https://app.morpho.org/"
        receiveHandler={jest.fn()}
        customInjectionRecordingCommand={{ token, action }}
        onCustomInjectionRecordingEvent={jest.fn()}
      />
    );
    const { rerender } = render(renderWebView('start'));
    const webview = await screen.findByTestId('desktop-webview');
    const send = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(webview, 'send', {
      configurable: true,
      value: send,
    });

    fireEvent(webview, new Event('dom-ready'));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
        { version: 1, token, action: 'start' },
      ),
    );

    fireEvent(
      webview,
      Object.assign(new Event('did-start-navigation'), {
        isInPlace: true,
        isMainFrame: true,
        url: 'https://app.morpho.org/vaults',
      }),
    );
    rerender(renderWebView('stop'));

    await waitFor(() =>
      expect(send).toHaveBeenLastCalledWith(
        CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
        { version: 1, token, action: 'stop' },
      ),
    );
  });

  it('toggles DevTools without jumping and shares the dragged position', async () => {
    mockDevSettingsEnabled = true;
    mockShowWebviewDevTools = true;
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent: jest
            .fn()
            .mockResolvedValue('file:///tmp/built-in-preload.js'),
        },
      },
    });

    const { rerender } = render(
      <DesktopWebView
        data-testid="desktop-webview"
        src="https://app.uniswap.org"
        receiveHandler={jest.fn()}
      />,
    );

    const webview = await screen.findByTestId('desktop-webview');
    const button = screen.getByTestId('webview-dev-tools');
    const toggleDevTools = jest.fn().mockResolvedValue('opened');
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getPreloadJsContent: jest
            .fn()
            .mockResolvedValue('file:///tmp/built-in-preload.js'),
          toggleDevTools,
        },
      },
    });
    Object.defineProperties(webview, {
      getWebContentsId: {
        configurable: true,
        value: () => 42,
      },
    });

    fireEvent.click(button);
    await waitFor(() => expect(toggleDevTools).toHaveBeenCalledTimes(1));
    expect(toggleDevTools).toHaveBeenLastCalledWith(42, true);
    expect(button.style.right).toBe('8px');
    expect(button.style.left).toBe('');
    expect(button.style.backgroundColor).toBe('rgb(0, 143, 14)');
    expect(button.style.color).toBe('rgb(255, 255, 255)');
    expect(button.style.transform).toBe('scale(0.88)');
    expect(button.querySelector('[data-icon="BugOutline"]')).not.toBeNull();
    await waitFor(() =>
      expect(button.style.backgroundColor).toBe('rgb(0, 184, 18)'),
    );
    expect(button.style.transform).toBe('');

    const container = button.parentElement;
    expect(container).not.toBeNull();
    jest
      .spyOn(container as HTMLElement, 'getBoundingClientRect')
      .mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 200,
        top: 0,
        width: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    jest.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      bottom: 20,
      height: 20,
      left: 150,
      right: 200,
      top: 0,
      width: 50,
      x: 150,
      y: 0,
      toJSON: () => ({}),
    });
    Object.defineProperties(button, {
      releasePointerCapture: {
        configurable: true,
        value: jest.fn(),
      },
      setPointerCapture: {
        configurable: true,
        value: jest.fn(),
      },
    });
    Object.defineProperty(globalThis, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });

    fireEvent.pointerDown(button, {
      button: 0,
      clientX: 175,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(button, {
      clientX: 100,
      clientY: 50,
      pointerId: 1,
    });
    fireEvent.pointerUp(button, { pointerId: 1 });
    fireEvent.click(button);

    expect(button.style.left).toBe('50%');
    expect(button.style.top).toBe('50%');
    expect(button.style.transform).toBe('translate(-50%, -50%)');
    expect(toggleDevTools).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    await waitFor(() => expect(toggleDevTools).toHaveBeenCalledTimes(2));
    expect(toggleDevTools).toHaveBeenLastCalledWith(42, true);

    rerender(
      <>
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
        />
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.aave.com"
          receiveHandler={jest.fn()}
        />
      </>,
    );
    expect(
      screen
        .getAllByTestId('webview-dev-tools')
        .every(
          (devToolsButton) =>
            devToolsButton.style.left === '50%' &&
            devToolsButton.style.top === '50%',
        ),
    ).toBe(true);

    mockShowWebviewDevTools = false;
    rerender(
      <>
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
        />
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.aave.com"
          receiveHandler={jest.fn()}
        />
      </>,
    );
    expect(screen.queryByTestId('webview-dev-tools')).toBeNull();

    mockShowWebviewDevTools = true;
    rerender(
      <>
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
        />
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.aave.com"
          receiveHandler={jest.fn()}
        />
      </>,
    );
    expect(
      screen
        .getAllByTestId('webview-dev-tools')
        .every(
          (resetButton) =>
            resetButton.style.right === '8px' &&
            resetButton.style.top === '8px' &&
            resetButton.style.left === '',
        ),
    ).toBe(true);
  });
});
