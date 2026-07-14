/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { DESKTOP_WEBVIEW_CHART_PARTITION } from '@onekeyhq/shared/src/consts/desktopWebviewPartitions';

import { DesktopWebView } from './DesktopWebView';
import { EDesktopWebViewPreloadKind } from './types';

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
      enabled: false,
      settings: {},
    },
  ],
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
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
    generateUUID: () => 'test-uuid',
  },
}));

jest.mock('./ErrorView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({ onRefresh }: { onRefresh: () => void }) =>
      React.createElement(
        'button',
        { 'data-testid': 'desktop-webview-error', onClick: onRefresh },
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
    Object.defineProperty(globalThis, 'ONEKEY_DESKTOP_GLOBALS', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'ONEKEY_DESKTOP_GLOBALS_GETTER', {
      configurable: true,
      value: undefined,
    });
  });

  it('falls back to the dapp preload on an old desktop shell', async () => {
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
          preloadKind={EDesktopWebViewPreloadKind.Chart}
        />
        <DesktopWebView
          data-testid="desktop-webview"
          src="https://app.uniswap.org"
          receiveHandler={jest.fn()}
          preloadKind={EDesktopWebViewPreloadKind.Chart}
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

  it('uses the chart preload when the desktop shell exposes offline assets', async () => {
    const getPreloadJsContent = jest
      .fn()
      .mockResolvedValue('file:///tmp/preload.js');
    const getChartPreloadJsContent = jest
      .fn()
      .mockResolvedValue('file:///tmp/desktop-chart-preload.js');
    Object.defineProperty(globalThis, 'ONEKEY_DESKTOP_GLOBALS', {
      configurable: true,
      value: { tradingViewOfflineReady: true },
    });
    Object.defineProperty(globalThis, 'desktopApiProxy', {
      configurable: true,
      value: {
        webview: {
          getChartPreloadJsContent,
          getPreloadJsContent,
        },
      },
    });

    render(
      <DesktopWebView
        data-testid="desktop-chart-webview"
        src="onekey-chart://local/index.html"
        receiveHandler={jest.fn()}
        preloadKind={EDesktopWebViewPreloadKind.Chart}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('desktop-chart-webview').getAttribute('preload'),
      ).toBe('file:///tmp/desktop-chart-preload.js'),
    );
    expect(
      screen.getByTestId('desktop-chart-webview').getAttribute('partition'),
    ).toBe(DESKTOP_WEBVIEW_CHART_PARTITION);
    expect(getChartPreloadJsContent).toHaveBeenCalledTimes(1);
    expect(getPreloadJsContent).not.toHaveBeenCalled();
  });
});
