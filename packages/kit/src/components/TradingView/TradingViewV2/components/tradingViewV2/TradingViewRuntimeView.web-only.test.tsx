/**
 * @jest-environment jsdom
 */

import type { PropsWithChildren } from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import { loadTradingViewEmbedModule } from './tradingViewEmbedLoader.web';
import TradingViewRuntimeView from './TradingViewRuntimeView.web-only';

jest.mock('@onekeyhq/components', () => ({
  Spinner: () => <div data-testid="embed-pending-spinner" />,
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@onekeyhq/kit/src/components/WebView', () => ({
  __esModule: true,
  default: () => <div data-testid="embed-iframe-fallback" />,
}));

jest.mock('./tradingViewEmbedLoader.web', () => ({
  loadTradingViewEmbedModule: jest.fn(),
}));

jest.mock('./tradingViewLegacyStorageMigration.web', () => ({
  migrateLegacyTradingViewStorage: jest.fn(() => Promise.resolve()),
}));

const mockedLoadModule = loadTradingViewEmbedModule as jest.MockedFunction<
  typeof loadTradingViewEmbedModule
>;

const SRC = 'https://tradingview.onekeytest.com/?symbol=BTC';

function mockLoadedModule() {
  return {
    assetBaseUrl: 'https://tradingview.onekeytest.com/sha/embed/',
    module: {
      mountTradingView: jest.fn(() =>
        Promise.resolve({ postMessage: jest.fn(), unmount: jest.fn() }),
      ),
    },
  };
}

describe('TradingViewRuntimeView pending state', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('keeps a pending indicator until the Embed runtime is mounted', async () => {
    let resolveModule: (
      value: ReturnType<typeof mockLoadedModule>,
    ) => void = () => {};
    mockedLoadModule.mockReturnValue(
      new Promise((resolve) => {
        resolveModule = resolve;
      }) as ReturnType<typeof loadTradingViewEmbedModule>,
    );

    render(<TradingViewRuntimeView src={SRC} />);

    // The bootstrap wait is the window that used to render an empty container.
    expect(screen.getByTestId('embed-pending-spinner')).toBeTruthy();

    resolveModule(mockLoadedModule());

    await waitFor(() =>
      expect(screen.queryByTestId('embed-pending-spinner')).toBeNull(),
    );
    expect(screen.queryByTestId('embed-iframe-fallback')).toBeNull();
  });

  test('drops the indicator when the Embed runtime falls back to the iframe', async () => {
    mockedLoadModule.mockRejectedValue(new Error('prefetch timed out'));

    render(<TradingViewRuntimeView src={SRC} />);

    await waitFor(() =>
      expect(screen.getByTestId('embed-iframe-fallback')).toBeTruthy(),
    );
    expect(screen.queryByTestId('embed-pending-spinner')).toBeNull();
  });
});
