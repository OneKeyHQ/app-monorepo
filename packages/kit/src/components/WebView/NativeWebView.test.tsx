/** @jest-environment jsdom */

import { createRef } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAvailabilityOutcome } from '@onekeyhq/shared/src/request/availabilityAggregator';

import { NativeWebView } from './NativeWebView';
import { WEBVIEW_LOAD_TIMEOUT_MS } from './utils';

import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

type IMockWebViewHandlerName =
  | 'onError'
  | 'onHttpError'
  | 'onLoad'
  | 'onLoadEnd'
  | 'onLoadProgress'
  | 'onLoadStart'
  | 'onRenderProcessGone';

type IMockWebViewHandler = (event: {
  nativeEvent: Record<string, unknown>;
}) => void;

type IMockWebViewProps = Partial<
  Record<IMockWebViewHandlerName, IMockWebViewHandler>
>;

const mockWebViewState: {
  mountCount: number;
  props: IMockWebViewProps | undefined;
  reload: jest.Mock;
} = {
  mountCount: 0,
  props: undefined,
  reload: jest.fn(),
};

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

jest.mock('@onekeyfe/onekey-cross-webview', () => ({
  JsBridgeNativeHost: class MockJsBridgeNativeHost {
    webviewWrapper: unknown;

    receive = jest.fn();
  },
}));

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    RefreshControl: React.forwardRef(
      ({ children }: { children?: React.ReactNode }, _ref) =>
        React.createElement('div', null, children),
    ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
  };
});

jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  interface IMockWebViewRef {
    injectJavaScript: jest.Mock;
    loadUrl: jest.Mock;
    reload: jest.Mock;
    stopLoading: jest.Mock;
  }

  return {
    WebView: React.forwardRef<IMockWebViewRef, IMockWebViewProps>(
      (props, ref) => {
        mockWebViewState.props = props;
        React.useEffect(() => {
          mockWebViewState.mountCount += 1;
        }, []);
        React.useImperativeHandle(ref, () => ({
          injectJavaScript: jest.fn(),
          loadUrl: jest.fn(),
          reload: mockWebViewState.reload,
          stopLoading: jest.fn(),
        }));

        const createNavigationEvent = (
          loading: boolean,
        ): Parameters<IMockWebViewHandler>[0] => ({
          nativeEvent: {
            canGoBack: false,
            canGoForward: false,
            loading,
            navigationType: 'other',
            title: 'Uniswap',
            url: 'https://app.uniswap.org/swap',
          },
        });

        return React.createElement(
          'div',
          { 'data-testid': 'native-webview' },
          React.createElement(
            'button',
            {
              'data-testid': 'start-loading',
              onClick: () => {
                props.onLoadStart?.(createNavigationEvent(true));
              },
            },
            'start loading',
          ),
          React.createElement(
            'button',
            {
              'data-testid': 'update-history',
              onClick: () => {
                props.onLoadStart?.(createNavigationEvent(false));
              },
            },
            'update history',
          ),
        );
      },
    ),
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    {
      enabled: false,
      settings: {},
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/modules3rdParty/geckoview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.forwardRef(() => React.createElement('div'));
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/utils/uriUtils', () => ({
  __esModule: true,
  checkOneKeyCardGoogleOauthUrl: () => false,
  default: {
    getOriginFromUrl: () => 'https://app.uniswap.org',
  },
}));

jest.mock('./ErrorView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: () =>
      React.createElement('div', { 'data-testid': 'webview-error' }),
  };
});

const SRC = 'https://app.uniswap.org';
const COMMITTED_SRC = 'https://app.uniswap.org/';

function emit(
  handlerName: IMockWebViewHandlerName,
  nativeEvent: Record<string, unknown>,
) {
  act(() => {
    mockWebViewState.props?.[handlerName]?.({ nativeEvent });
  });
}

function emitInOneNativeCall(
  events: Array<[IMockWebViewHandlerName, Record<string, unknown>]>,
) {
  act(() => {
    events.forEach(([handlerName, nativeEvent]) => {
      mockWebViewState.props?.[handlerName]?.({ nativeEvent });
    });
  });
}

function flushDeferredSettle() {
  act(() => {
    jest.advanceTimersByTime(1);
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

function renderNativeWebView(src = SRC) {
  const ref = createRef<IWebViewWrapperRef>();
  const result = render(
    <NativeWebView ref={ref} src={src} pullToRefreshEnabled={false} />,
  );
  return { ...result, ref };
}

describe('NativeWebView loading timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    platformEnv.isNativeAndroid = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not time out an Android same-document history update', () => {
    render(
      <NativeWebView
        src="https://app.uniswap.org"
        pullToRefreshEnabled={false}
      />,
    );

    fireEvent.click(screen.getByTestId('update-history'));
    act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS));

    expect(screen.queryByTestId('webview-error')).toBeNull();
  });

  it('cancels a pending timeout when Android reports loading as false', () => {
    render(
      <NativeWebView
        src="https://app.uniswap.org"
        pullToRefreshEnabled={false}
      />,
    );

    fireEvent.click(screen.getByTestId('start-loading'));
    act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
    fireEvent.click(screen.getByTestId('update-history'));
    act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS));

    expect(screen.queryByTestId('webview-error')).toBeNull();
  });

  it('still times out an Android page that remains loading', () => {
    render(
      <NativeWebView
        src="https://app.uniswap.org"
        pullToRefreshEnabled={false}
      />,
    );

    fireEvent.click(screen.getByTestId('start-loading'));
    act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS));

    expect(screen.getByTestId('webview-error')).toBeTruthy();
  });
});

describe('NativeWebView availability metrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    platformEnv.isNativeAndroid = true;
    mockRecordAvailabilityOutcome.mockClear();
    mockCreateWebViewAvailabilityTiming.mockClear();
    mockWebViewState.mountCount = 0;
    mockWebViewState.props = undefined;
    mockWebViewState.reload.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Android WebView', () => {
    it('records a load whose finish event precedes onError as network_error', () => {
      const { unmount } = renderNativeWebView();

      // RNCWebViewClient.onReceivedError emits the finish event first.
      emitInOneNativeCall([
        ['onLoad', { loading: false, url: SRC }],
        ['onLoadEnd', { loading: false, url: SRC }],
        ['onError', { code: -2, description: 'net::ERR', url: SRC }],
        ['onLoadEnd', { loading: false, url: SRC }],
      ]);
      flushDeferredSettle();
      // Error page commit, then the start/finish pair older WebViews add.
      emit('onLoadStart', { loading: false, url: SRC });
      emit('onLoadStart', { loading: true, url: SRC });
      emit('onLoad', { loading: false, url: SRC });
      flushDeferredSettle();
      unmount();

      expect(getOutcomes()).toEqual([
        {
          errorCode: '-2',
          source: 'webview',
          status: 'network_error',
          target: 'external-web',
        },
      ]);
    });

    it('settles a successful load as ok one tick after its finish event', () => {
      const { unmount } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      expect(getOutcomes()).toEqual([]);

      flushDeferredSettle();
      unmount();

      expect(getOutcomes()).toEqual([
        {
          errorCode: undefined,
          source: 'webview',
          status: 'ok',
          target: 'external-web',
        },
      ]);
      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
    });

    it('records an HTTP error that arrives before load start', () => {
      const url = 'https://app.uniswap.org/swap';
      const { unmount } = renderNativeWebView(url);

      emit('onHttpError', { statusCode: 503, url });
      emit('onLoadStart', { loading: true, url });
      emit('onLoad', { loading: false, url });
      flushDeferredSettle();
      unmount();

      expect(getOutcomes()).toEqual([
        {
          errorCode: '503',
          source: 'webview',
          status: 'http_error',
          target: 'external-web',
        },
      ]);
    });

    it('applies an HTTP error of a redirect target at its commit', () => {
      const redirectUrl = 'https://app.uniswap.org/missing';
      const { unmount } = renderNativeWebView();

      emit('onHttpError', { statusCode: 404, url: redirectUrl });
      expect(getOutcomes()).toEqual([]);

      emit('onLoadStart', { loading: true, url: redirectUrl });
      emit('onLoad', { loading: false, url: redirectUrl });
      flushDeferredSettle();
      unmount();

      expect(getOutcomes()).toEqual([
        {
          errorCode: '404',
          source: 'webview',
          status: 'http_error',
          target: 'external-web',
        },
      ]);
    });

    it('does not apply a stale HTTP error to a later successful load', () => {
      const { rerender } = renderNativeWebView();

      emit('onHttpError', { statusCode: 404, url: 'https://other.example/' });
      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      flushDeferredSettle();

      rerender(
        <NativeWebView
          src="https://other.example/"
          pullToRefreshEnabled={false}
        />,
      );
      emit('onLoadStart', { loading: true, url: 'https://other.example/' });
      emit('onLoad', { loading: false, url: 'https://other.example/' });
      flushDeferredSettle();

      expect(getOutcomes().map(({ status }) => status)).toEqual(['ok', 'ok']);
    });

    it('reuses one attempt across redirects and same-document updates', () => {
      const { unmount } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoadStart', {
        loading: true,
        url: 'https://app.uniswap.org/swap',
      });
      emit('onLoadStart', {
        loading: false,
        url: 'https://app.uniswap.org/swap?chain=base',
      });
      emit('onLoad', {
        loading: false,
        url: 'https://app.uniswap.org/swap?chain=base',
      });
      flushDeferredSettle();
      unmount();

      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
      expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
    });

    it('does not start an attempt from a commit it did not request', () => {
      const { unmount } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      flushDeferredSettle();

      // In-page navigation: its pre-commit failures are not observable.
      emit('onLoadStart', { loading: true, url: 'https://app.uniswap.org/x' });
      emit('onLoad', { loading: false, url: 'https://app.uniswap.org/x' });
      flushDeferredSettle();
      emit('onError', { code: -2, url: 'https://app.uniswap.org/y' });
      unmount();

      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
      expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
    });

    it('ignores the finish event of an aborted navigation', () => {
      const { unmount } = renderNativeWebView();

      emit('onLoad', { loading: true, url: 'onekey-wallet://deeplink' });
      flushDeferredSettle();
      expect(getOutcomes()).toEqual([]);

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      flushDeferredSettle();
      unmount();

      expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
    });

    it('records render process loss and starts a fresh attempt on remount', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { unmount } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onRenderProcessGone', { didCrash: true });

      expect(mockWebViewState.mountCount).toBe(2);
      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(2);

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      flushDeferredSettle();
      unmount();

      expect(getOutcomes()).toEqual([
        {
          errorCode: 'crashed',
          source: 'webview',
          status: 'render_process_gone',
          target: 'external-web',
        },
        {
          errorCode: undefined,
          source: 'webview',
          status: 'ok',
          target: 'external-web',
        },
      ]);
    });

    it('starts attempts for a source change and for a reload it issues', () => {
      const otherUrl = 'https://other.example/';
      const { ref, rerender } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });
      flushDeferredSettle();

      rerender(
        <NativeWebView ref={ref} src={otherUrl} pullToRefreshEnabled={false} />,
      );
      emit('onError', { code: -105, url: otherUrl });
      emit('onLoadStart', { loading: false, url: otherUrl });

      act(() => {
        ref.current?.reload();
      });
      expect(mockWebViewState.reload).toHaveBeenCalledTimes(1);
      emit('onLoadStart', { loading: true, url: otherUrl });
      emit('onLoad', { loading: false, url: otherUrl });
      flushDeferredSettle();

      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(3);
      expect(getOutcomes()).toEqual([
        {
          errorCode: undefined,
          source: 'webview',
          status: 'ok',
          target: 'external-web',
        },
        {
          errorCode: '-105',
          source: 'webview',
          status: 'network_error',
          target: 'external-web',
        },
        {
          errorCode: undefined,
          source: 'webview',
          status: 'ok',
          target: 'external-web',
        },
      ]);
    });

    it('records the patched connection-failed progress state as network_error', () => {
      renderNativeWebView();

      emit('onLoadProgress', { progress: 1, url: null });

      expect(getOutcomes()).toEqual([
        {
          errorCode: '-1001000',
          source: 'webview',
          status: 'network_error',
          target: 'external-web',
        },
      ]);
    });

    it('records a load that stays unfinished as timeout', () => {
      renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS));

      expect(screen.getByTestId('webview-error')).toBeTruthy();
      expect(getOutcomes().map(({ status }) => status)).toEqual(['timeout']);
    });

    describe('attempt deadline', () => {
      it('records an attempt that never commits as timeout without showing the timeout view', () => {
        const { unmount } = renderNativeWebView();

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS - 1));
        expect(getOutcomes()).toEqual([]);

        act(() => jest.advanceTimersByTime(1));
        expect(getOutcomes()).toEqual([
          {
            errorCode: 'unknown',
            source: 'webview',
            status: 'timeout',
            target: 'external-web',
          },
        ]);
        expect(screen.queryByTestId('webview-error')).toBeNull();
        expect(jest.getTimerCount()).toBe(0);

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS * 2));
        unmount();

        expect(getOutcomes().map(({ status }) => status)).toEqual(['timeout']);
      });

      it('does not record a timeout for an attempt that loads before its deadline', () => {
        const { unmount } = renderNativeWebView();

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
        emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
        emit('onLoad', { loading: false, url: COMMITTED_SRC });
        flushDeferredSettle();

        expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
        expect(jest.getTimerCount()).toBe(0);

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS * 2));
        unmount();

        expect(getOutcomes().map(({ status }) => status)).toEqual(['ok']);
      });

      it.each<{
        events: Array<[IMockWebViewHandlerName, Record<string, unknown>]>;
        name: string;
        status: string;
      }>([
        {
          name: 'a load error',
          events: [['onError', { code: -2, url: SRC }]],
          status: 'network_error',
        },
        {
          name: 'the patched connection-failed progress state',
          events: [['onLoadProgress', { progress: 1, url: null }]],
          status: 'network_error',
        },
        {
          name: 'an HTTP error of the requested URL',
          events: [['onHttpError', { statusCode: 503, url: SRC }]],
          status: 'http_error',
        },
        {
          name: 'an HTTP error applied at commit',
          events: [
            ['onHttpError', { statusCode: 404, url: COMMITTED_SRC }],
            ['onLoadStart', { loading: true, url: COMMITTED_SRC }],
            ['onLoad', { loading: false, url: COMMITTED_SRC }],
          ],
          status: 'http_error',
        },
      ])(
        'does not record a timeout for an attempt that ends with $name',
        ({ events, status }) => {
          renderNativeWebView();

          events.forEach(([handlerName, nativeEvent]) => {
            emit(handlerName, nativeEvent);
          });
          flushDeferredSettle();
          expect(jest.getTimerCount()).toBe(0);
          act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS * 2));

          expect(getOutcomes().map((outcome) => outcome.status)).toEqual([
            status,
          ]);
        },
      );

      it('records only cancelled when unmounted before the deadline', () => {
        const { unmount } = renderNativeWebView();

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
        unmount();

        expect(getOutcomes().map(({ status }) => status)).toEqual([
          'cancelled',
        ]);
        expect(jest.getTimerCount()).toBe(0);

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS * 2));

        expect(getOutcomes().map(({ status }) => status)).toEqual([
          'cancelled',
        ]);
      });

      it('keeps the original deadline when a load continues the attempt', () => {
        const { ref } = renderNativeWebView();

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
        act(() => {
          ref.current?.loadURL('https://app.uniswap.org/swap');
        });
        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));

        expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
        expect(getOutcomes().map(({ status }) => status)).toEqual(['timeout']);
        expect(screen.queryByTestId('webview-error')).toBeNull();
      });

      it('replaces the deadline of an attempt lost with its render process', () => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        renderNativeWebView();

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
        emit('onRenderProcessGone', { didCrash: false });
        expect(mockWebViewState.mountCount).toBe(2);
        // Only the remounted attempt's deadline remains.
        expect(jest.getTimerCount()).toBe(1);

        act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS - 1));
        expect(getOutcomes().map(({ status }) => status)).toEqual([
          'render_process_gone',
        ]);

        act(() => jest.advanceTimersByTime(1));
        expect(getOutcomes().map(({ status }) => status)).toEqual([
          'render_process_gone',
          'timeout',
        ]);
        expect(jest.getTimerCount()).toBe(0);
      });
    });
  });

  describe('iOS WebView', () => {
    beforeEach(() => {
      platformEnv.isNativeAndroid = false;
    });

    it('records a successful load as ok when it finishes', () => {
      const { unmount } = renderNativeWebView();
      expect(mockCreateWebViewAvailabilityTiming).not.toHaveBeenCalled();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoad', { loading: false, url: COMMITTED_SRC });

      expect(getOutcomes()).toEqual([
        {
          errorCode: undefined,
          source: 'webview',
          status: 'ok',
          target: 'external-web',
        },
      ]);
      unmount();
      expect(getOutcomes()).toHaveLength(1);
    });

    it('arms no attempt deadline before load start', () => {
      const { unmount } = renderNativeWebView();

      expect(jest.getTimerCount()).toBe(0);
      act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS * 2));
      unmount();

      expect(mockCreateWebViewAvailabilityTiming).not.toHaveBeenCalled();
      expect(getOutcomes()).toEqual([]);
    });

    it('still records a load that stays unfinished as timeout with the timeout view', () => {
      renderNativeWebView();

      act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS / 2));
      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      act(() => jest.advanceTimersByTime(WEBVIEW_LOAD_TIMEOUT_MS - 1));
      expect(getOutcomes()).toEqual([]);
      expect(screen.queryByTestId('webview-error')).toBeNull();

      act(() => jest.advanceTimersByTime(1));

      expect(screen.getByTestId('webview-error')).toBeTruthy();
      expect(getOutcomes().map(({ status }) => status)).toEqual(['timeout']);
    });

    it('reuses one attempt across a redirect chain', () => {
      const { unmount } = renderNativeWebView();

      emit('onLoadStart', { loading: true, url: COMMITTED_SRC });
      emit('onLoadStart', {
        loading: true,
        url: 'https://app.uniswap.org/swap',
      });
      emit('onHttpError', {
        statusCode: 502,
        url: 'https://app.uniswap.org/swap',
      });
      emit('onLoad', { loading: false, url: 'https://app.uniswap.org/swap' });
      unmount();

      expect(mockCreateWebViewAvailabilityTiming).toHaveBeenCalledTimes(1);
      expect(getOutcomes()).toEqual([
        {
          errorCode: '502',
          source: 'webview',
          status: 'http_error',
          target: 'external-web',
        },
      ]);
    });
  });
});
