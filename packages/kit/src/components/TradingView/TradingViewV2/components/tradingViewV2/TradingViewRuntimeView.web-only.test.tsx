/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import { createTradingViewEmbedReadyMonitor } from './tradingViewEmbedReady.web';
import { migrateLegacyTradingViewStorage } from './tradingViewLegacyStorageMigration.web';
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
  loadTradingViewEmbedModule: jest.fn(),
}));

jest.mock('./tradingViewEmbedReady.web', () => ({
  createTradingViewEmbedReadyMonitor: jest.fn(() => ({
    cancel: jest.fn(),
    notify: jest.fn(),
    wait: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock('./tradingViewLegacyStorageMigration.web', () => ({
  migrateLegacyTradingViewStorage: jest.fn(() => Promise.resolve()),
}));

describe('TradingViewRuntimeView web fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(loadTradingViewEmbedModule)
      .mockRejectedValue(new Error('embed unavailable'));
  });

  it('keeps TradingView messages out of the generic background bridge', async () => {
    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    expect(await screen.findByTestId('fallback-webview')).toBeTruthy();
    expect(webViewProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ skipBackgroundBridge: true }),
    );
  });

  it('starts module loading and legacy migration in parallel before mount', async () => {
    let resolveModule:
      | ((
          value: Awaited<ReturnType<typeof loadTradingViewEmbedModule>>,
        ) => void)
      | undefined;
    let resolveMigration: (() => void) | undefined;
    const mountTradingView = jest.fn(() =>
      Promise.resolve({ postMessage: jest.fn(), unmount: jest.fn() }),
    );
    jest.mocked(loadTradingViewEmbedModule).mockReturnValue(
      new Promise((resolve) => {
        resolveModule = resolve;
      }) as ReturnType<typeof loadTradingViewEmbedModule>,
    );
    jest.mocked(migrateLegacyTradingViewStorage).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveMigration = resolve;
      }),
    );

    render(<TradingViewRuntimeView src="https://tradingview.onekeytest.com" />);

    await waitFor(() => {
      expect(loadTradingViewEmbedModule).toHaveBeenCalledTimes(1);
      expect(migrateLegacyTradingViewStorage).toHaveBeenCalledTimes(1);
    });
    resolveModule?.({
      assetBaseUrl: 'https://app-bundle.onekeytest.com/tv/',
      module: { mountTradingView },
    });
    await Promise.resolve();
    expect(mountTradingView).not.toHaveBeenCalled();

    resolveMigration?.();
    await waitFor(() => expect(mountTradingView).toHaveBeenCalledTimes(1));
    expect(createTradingViewEmbedReadyMonitor).toHaveBeenCalledTimes(1);
  });
});
