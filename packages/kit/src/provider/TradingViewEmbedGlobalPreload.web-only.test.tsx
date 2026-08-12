/**
 * @jest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';

import {
  loadTradingViewEmbedModule,
  preloadTradingViewEmbedBootstrapAssets,
} from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web';
import { migrateLegacyTradingViewStorage } from '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web';
import { preloadMarketTradingView } from '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView';

import { preloadTasksOnIdle } from './preloadComponents';
import { TradingViewEmbedGlobalPreload } from './TradingViewEmbedGlobalPreload.web-only';

jest.mock('../components/TradingView/hooks/useTradingViewUrl', () => ({
  useTradingViewUrl: () => ({
    baseUrl: 'http://localhost:5173/',
    finalUrl: 'http://localhost:5173/?locale=zh-CN',
  }),
}));

jest.mock(
  '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewEmbedLoader.web',
  () => ({
    loadTradingViewEmbedModule: jest.fn(() => Promise.resolve()),
    preloadTradingViewEmbedBootstrapAssets: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../components/TradingView/TradingViewV2/components/tradingViewV2/tradingViewLegacyStorageMigration.web',
  () => ({
    migrateLegacyTradingViewStorage: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock(
  '../views/Market/MarketDetailV2/components/MarketTradingView/LazyMarketTradingView',
  () => ({
    preloadMarketTradingView: jest.fn(() => Promise.resolve()),
  }),
);

jest.mock('./preloadComponents', () => ({
  preloadTasksOnIdle: jest.fn(),
}));

describe('TradingViewEmbedGlobalPreload', () => {
  const cleanup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(preloadTasksOnIdle).mockReturnValue(cleanup);
  });

  test('schedules Market and local embed preloads through the idle runner', async () => {
    const view = render(<TradingViewEmbedGlobalPreload />);

    await waitFor(() => {
      expect(preloadTasksOnIdle).toHaveBeenCalledTimes(1);
    });
    const [tasks, logPrefix] = jest.mocked(preloadTasksOnIdle).mock.calls[0];
    expect(tasks.map((task) => task.name)).toEqual([
      'TradingViewEmbedModule',
      'MarketTradingView',
      'TradingViewEmbedBootstrapAssets',
    ]);
    expect(logPrefix).toBe('TradingViewEmbedPreload');
    expect(loadTradingViewEmbedModule).not.toHaveBeenCalled();
    expect(preloadTradingViewEmbedBootstrapAssets).not.toHaveBeenCalled();

    await Promise.all(tasks.map((task) => task.preload()));

    expect(preloadMarketTradingView).toHaveBeenCalledTimes(1);
    expect(loadTradingViewEmbedModule).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );
    expect(migrateLegacyTradingViewStorage).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );
    expect(preloadTradingViewEmbedBootstrapAssets).toHaveBeenCalledWith(
      'http://localhost:5173/?locale=zh-CN',
    );

    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
