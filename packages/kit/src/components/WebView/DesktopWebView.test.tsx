/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IAvailabilityOutcome } from '@onekeyhq/shared/src/request/availabilityAggregator';

import { DesktopWebView } from './DesktopWebView';

const mockRecordAvailabilityOutcome = jest.fn();
const mockCreateWebViewAvailabilityTiming = jest.fn();

jest.mock('@onekeyhq/shared/src/request/availabilityAggregator', () => ({
  normalizeAvailabilityToken: jest.fn(),
  recordAvailabilityOutcome: (...args: unknown[]) => {
    mockRecordAvailabilityOutcome(...args);
  },
  startAvailabilityFlow: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/availabilityMetrics', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityMetrics')
  >('@onekeyhq/shared/src/request/availabilityMetrics');
  return {
    ...actual,
    createWebViewAvailabilityTiming: (
      ...args: Parameters<typeof actual.createWebViewAvailabilityTiming>
    ) => {
      mockCreateWebViewAvailabilityTiming(...args);
      return actual.createWebViewAvailabilityTiming(...args);
    },
  };
});

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

const SRC = 'https://app.uniswap.org/';

function dispatchWebViewEvent(
  node: Element,
  type: string,
  props: Record<string, unknown> = {},
) {
  const event = new Event(type);
  Object.assign(event, props);
  act(() => {
    node.dispatchEvent(event);
  });
}

function getOutcomes() {
  return (mockRecordAvailabilityOutcome.mock.calls as [IAvailabilityOutcome][])
    .map(([outcome]) => outcome)
    .map(({ errorCode, source, status, target }) => ({
      errorCode,
      source,
      status,
      target,
    }));
}

async function renderDesktopWebView() {
  const result = render(
    <DesktopWebView data-testid="desktop-webview" src={SRC} disableBridge />,
  );
  await waitFor(() =>
    expect(result.container.querySelector('webview')).not.toBeNull(),
  );
  const node = result.container.querySelector('webview') as Element;
  return { ...result, node };
}

function startMainFrameNavigation(
  node: Element,
  url: string,
  isInPlace = false,
) {
  dispatchWebViewEvent(node, 'did-start-navigation', {
    isInPlace,
    isMainFrame: true,
    url,
  });
}

describe('DesktopWebView availability metrics', () => {
  beforeEach(() => {
    mockRecordAvailabilityOutcome.mockClear();
    mockCreateWebViewAvailabilityTiming.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a main-frame HTTP error response as http_error', async () => {
    const { node, unmount } = await renderDesktopWebView();

    startMainFrameNavigation(node, SRC);
    dispatchWebViewEvent(node, 'did-frame-navigate', {
      httpResponseCode: 502,
      httpStatusText: 'Bad Gateway',
      isMainFrame: true,
      url: SRC,
    });
    dispatchWebViewEvent(node, 'did-finish-load');
    dispatchWebViewEvent(node, 'did-stop-loading');

    // The HTTP error page is rendered content, not the error overlay.
    expect(screen.queryByTestId('desktop-webview-error')).toBeNull();
    unmount();

    expect(getOutcomes()).toEqual([
      {
        errorCode: '502',
        source: 'webview',
        status: 'http_error',
        target: 'external-web',
      },
    ]);
  });

  it('ignores subframe and successful did-frame-navigate responses', async () => {
    const { node } = await renderDesktopWebView();

    startMainFrameNavigation(node, SRC);
    dispatchWebViewEvent(node, 'did-frame-navigate', {
      httpResponseCode: 404,
      isMainFrame: false,
      url: 'https://ads.example/frame',
    });
    dispatchWebViewEvent(node, 'did-frame-navigate', {
      httpResponseCode: 200,
      isMainFrame: true,
      url: SRC,
    });
    dispatchWebViewEvent(node, 'did-finish-load');

    expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
  });

  it('does not settle the attempt on a superseded (-3) load', async () => {
    const { node } = await renderDesktopWebView();
    const nextUrl = 'https://app.uniswap.org/swap';

    startMainFrameNavigation(node, SRC);
    dispatchWebViewEvent(node, 'did-fail-load', {
      errorCode: -3,
      errorDescription: 'ERR_ABORTED',
      isMainFrame: true,
      validatedURL: SRC,
    });
    expect(getOutcomes()).toEqual([]);

    startMainFrameNavigation(node, nextUrl);
    dispatchWebViewEvent(node, 'did-finish-load');

    expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
    expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
  });

  it('does not create an attempt for a same-document navigation', async () => {
    const { node, unmount } = await renderDesktopWebView();

    startMainFrameNavigation(node, SRC);
    dispatchWebViewEvent(node, 'did-finish-load');
    startMainFrameNavigation(node, `${SRC}#section`, true);
    unmount();

    expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
    expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
  });

  it('ignores did-fail-load for a URL other than the current attempt', async () => {
    // The mocked Stack forwards layout props such as zIndex to a DOM node.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { node } = await renderDesktopWebView();

    startMainFrameNavigation(node, SRC);
    dispatchWebViewEvent(node, 'did-fail-load', {
      errorCode: -105,
      errorDescription: 'ERR_NAME_NOT_RESOLVED',
      isMainFrame: true,
      validatedURL: 'https://stale.example/',
    });

    expect(getOutcomes()).toEqual([]);
    // The error overlay still follows the main-frame failure.
    expect(screen.getByTestId('desktop-webview-error')).toBeTruthy();

    dispatchWebViewEvent(node, 'did-fail-load', {
      errorCode: -105,
      errorDescription: 'ERR_NAME_NOT_RESOLVED',
      isMainFrame: true,
      validatedURL: SRC,
    });

    expect(getOutcomes()).toEqual([
      {
        errorCode: '-105',
        source: 'webview',
        status: 'network_error',
        target: 'external-web',
      },
    ]);
  });
});
