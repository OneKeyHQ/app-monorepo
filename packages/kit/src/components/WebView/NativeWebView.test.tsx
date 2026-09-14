/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { NativeWebView } from './NativeWebView';
import { WEBVIEW_LOAD_TIMEOUT_MS } from './utils';

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

  interface IMockNavigationEvent {
    nativeEvent: {
      canGoBack: boolean;
      canGoForward: boolean;
      loading: boolean;
      navigationType: string;
      title: string;
      url: string;
    };
  }

  interface IMockWebViewProps {
    onLoadStart: (event: IMockNavigationEvent) => void;
  }

  interface IMockWebViewRef {
    injectJavaScript: jest.Mock;
    loadUrl: jest.Mock;
    reload: jest.Mock;
    stopLoading: jest.Mock;
  }

  return {
    WebView: React.forwardRef<IMockWebViewRef, IMockWebViewProps>(
      (props, ref) => {
        React.useImperativeHandle(ref, () => ({
          injectJavaScript: jest.fn(),
          loadUrl: jest.fn(),
          reload: jest.fn(),
          stopLoading: jest.fn(),
        }));

        const createNavigationEvent = (
          loading: boolean,
        ): IMockNavigationEvent => ({
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
                props.onLoadStart(createNavigationEvent(true));
              },
            },
            'start loading',
          ),
          React.createElement(
            'button',
            {
              'data-testid': 'update-history',
              onClick: () => {
                props.onLoadStart(createNavigationEvent(false));
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

describe('NativeWebView loading timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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
