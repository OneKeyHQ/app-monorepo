/** @jest-environment jsdom */

import { act, cleanup, render, waitFor } from '@testing-library/react';

import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { MarketWidgetSync } from './index.native';

const mockSetConfiguration = jest.fn(async (_value: unknown) => undefined);
const mockGetNativeTokenAddress = jest.fn(async (_value: unknown) => '0xeeee');
let mockWatchlist: IMarketWatchListItemV2[] = [];
const mockReadWatchlist = jest.fn(async () => ({ data: mockWatchlist }));
let mockSupported = true;
let mockMasked = false;
let mockWatchlistChanged: (() => void) | undefined;
let mockAppStateChanged: ((state: string) => void) | undefined;

jest.mock('react-intl', () => ({ useIntl: () => ({ locale: 'zh-CN' }) }));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_name: string, callback: (state: string) => void) => {
      mockAppStateChanged = callback;
      return {
        remove: () => {
          mockAppStateChanged = undefined;
        },
      };
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MarketWatchListV2Changed: 'watchlist' },
  appEventBus: {
    on: (_name: string, callback: () => void) => {
      mockWatchlistChanged = callback;
    },
    off: () => {
      mockWatchlistChanged = undefined;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    isSupported: () => mockSupported,
    setConfiguration: (value: unknown) => mockSetConfiguration(value),
  },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    ready: Promise.resolve(),
    isMaskingDataSync: () => mockMasked,
  },
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: { getMarketWatchListV2: () => mockReadWatchlist() },
    serviceToken: {
      getNativeTokenAddress: (value: unknown) =>
        mockGetNativeTokenAddress(value),
    },
  },
}));

describe('native market widget sync host', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupported = true;
    mockMasked = false;
    mockWatchlist = [
      { chainId: 'evm--1', contractAddress: '', isNative: true },
    ];
  });
  afterEach(cleanup);

  it('syncs public identities on mount, watchlist changes, and foreground', async () => {
    render(<MarketWidgetSync />);
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(1));
    expect(mockSetConfiguration).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      locale: 'zh-CN',
      greenUp: true,
      privacyMasked: false,
      assets: [
        {
          kind: 'token',
          chainId: 'evm--1',
          contractAddress: '',
          requestTokenAddress: '0xeeee',
          isNative: true,
          symbol: '',
          name: '',
        },
      ],
    });
    expect(mockGetNativeTokenAddress).toHaveBeenCalledWith({
      networkId: 'evm--1',
    });
    mockWatchlist = [{ assetId: 'bitcoin', chainId: '', contractAddress: '' }];
    act(() => mockWatchlistChanged?.());
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(2));
    mockWatchlist = [];
    act(() => mockAppStateChanged?.('active'));
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(3));
    expect(mockSetConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ assets: [], privacyMasked: false }),
    );
  });

  it('does not query background services on older binaries without the native module', async () => {
    mockSupported = false;
    render(<MarketWidgetSync />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockReadWatchlist).not.toHaveBeenCalled();
    expect(mockSetConfiguration).not.toHaveBeenCalled();
  });

  it('clears exported identities in the masked runtime without reading the real watchlist', async () => {
    mockMasked = true;
    render(<MarketWidgetSync />);
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(1));
    expect(mockReadWatchlist).not.toHaveBeenCalled();
    expect(mockSetConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ assets: [], privacyMasked: true }),
    );
  });

  it('distinguishes an empty watchlist from a masked runtime on foreground sync', async () => {
    mockWatchlist = [];
    render(<MarketWidgetSync />);
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(1));
    expect(mockSetConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ assets: [], privacyMasked: false }),
    );

    mockMasked = true;
    act(() => mockAppStateChanged?.('active'));
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(2));
    expect(mockReadWatchlist).toHaveBeenCalledTimes(1);
    expect(mockSetConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ assets: [], privacyMasked: true }),
    );

    mockMasked = false;
    act(() => mockAppStateChanged?.('active'));
    await waitFor(() => expect(mockSetConfiguration).toHaveBeenCalledTimes(3));
    expect(mockReadWatchlist).toHaveBeenCalledTimes(2);
    expect(mockSetConfiguration).toHaveBeenLastCalledWith(
      expect.objectContaining({ assets: [], privacyMasked: false }),
    );
  });
});
