/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { DesktopWebView } from './DesktopWebView';

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
});
