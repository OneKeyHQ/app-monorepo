/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import TradingViewRuntimeView from './TradingViewRuntimeView.web-only';

const webViewProps = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

jest.mock('@onekeyhq/kit/src/components/WebView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      webViewProps(props);
      return React.createElement('div', { 'data-testid': 'fallback-webview' });
    },
  };
});

jest.mock('./tradingViewEmbedLoader.web', () => ({
  loadTradingViewEmbedModule: jest.fn(() =>
    Promise.reject(new Error('embed unavailable')),
  ),
}));

jest.mock('./tradingViewEmbedReady.web', () => ({
  createTradingViewEmbedReadyMonitor: jest.fn(),
}));

jest.mock('./tradingViewLegacyStorageMigration.web', () => ({
  migrateLegacyTradingViewStorage: jest.fn(),
}));

describe('TradingViewRuntimeView web fallback', () => {
  beforeEach(() => {
    webViewProps.mockClear();
  });

  it('keeps TradingView messages out of the generic background bridge', async () => {
    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    expect(webViewProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ skipBackgroundBridge: true }),
    );
  });
});
