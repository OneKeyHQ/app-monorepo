import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import {
  getTradingViewNativeIntervalStorageNamespace,
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from './tradingViewNativeIntervalStorage';

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: jest.fn(),
      setObject: jest.fn(),
    },
  },
}));

const mockSyncStorage = jest.requireMock<{
  default: {
    syncStorage: {
      getObject: jest.Mock;
      setObject: jest.Mock;
    };
  };
}>('@onekeyhq/shared/src/storage/appStorage').default.syncStorage;

describe('TradingViewNative active interval storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses separate V2-compatible namespaces for each source type', () => {
    expect(
      getTradingViewNativeIntervalStorageNamespace({
        kind: 'market',
        isNative: true,
        networkId: 'evm--1',
        realtime: 'disabled',
        symbol: 'ETH',
        tokenAddress: '0xeeee',
      }),
    ).toBe('native');
    expect(
      getTradingViewNativeIntervalStorageNamespace({
        kind: 'market',
        networkId: 'evm--1',
        realtime: 'disabled',
        symbol: 'TOKEN',
        tokenAddress: '0xabc',
      }),
    ).toBe('token');
    expect(
      getTradingViewNativeIntervalStorageNamespace({
        coin: 'BTC',
        environment: 'mainnet',
        kind: 'hyperliquid',
      }),
    ).toBe('market-hyperliquid');
    expect(
      getTradingViewNativeIntervalStorageNamespace({
        kind: 'stock',
        stockId: 'AAPL',
      }),
    ).toBe('stock');
    expect(
      getTradingViewNativeIntervalStorageNamespace({
        kind: 'asset',
        assetId: 'doge',
      }),
    ).toBe('asset');
  });

  it('restores only supported saved intervals', () => {
    mockSyncStorage.getObject.mockReturnValue({
      token: {
        interval: '15',
        timestamp: 100,
        version: 1,
      },
    });
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');

    mockSyncStorage.getObject.mockReturnValue({
      token: {
        interval: 'unsupported',
        timestamp: 100,
        version: 1,
      },
    });
    expect(readTradingViewNativeActiveInterval('token')).toBe('60');
  });

  it('merges a successfully displayed interval into existing namespaces', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(200);
    mockSyncStorage.getObject.mockReturnValue({
      native: {
        interval: '240',
        timestamp: 100,
        version: 1,
      },
    });

    await saveTradingViewNativeActiveInterval({
      interval: '15',
      namespace: 'token',
    });

    expect(mockSyncStorage.setObject).toHaveBeenCalledWith(
      EAppSyncStorageKeys.onekey_trading_view_native_active_intervals_v1,
      {
        native: {
          interval: '240',
          timestamp: 100,
          version: 1,
        },
        token: {
          interval: '15',
          timestamp: 200,
          version: 1,
        },
      },
    );
  });
});
