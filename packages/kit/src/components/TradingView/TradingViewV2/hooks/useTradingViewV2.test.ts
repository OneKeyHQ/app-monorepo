import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

import { fetchTradingViewV2DataWithSlicing } from './useTradingViewV2';

type IFetchMarketTokenKline = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse>;

const mockFetchMarketTokenKline: jest.MockedFunction<IFetchMarketTokenKline> =
  jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenKline: (params: Parameters<IFetchMarketTokenKline>[0]) =>
        mockFetchMarketTokenKline(params),
    },
  },
}));

jest.mock('../sliceRequest', () => ({
  sliceRequest: jest.fn(),
}));

const mockSliceRequest = sliceRequest as jest.MockedFunction<
  typeof sliceRequest
>;

function buildPoint(t: number, close = t): IMarketTokenKLineDataPoint {
  return {
    o: close,
    h: close,
    l: close,
    c: close,
    v: 0,
    t,
  };
}

describe('fetchTradingViewV2DataWithSlicing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clips expanded slice data to the original request window and normalizes points', async () => {
    mockSliceRequest.mockReturnValue([
      { from: 900, to: 1060, interval: '1m' },
      { from: 1060, to: 1120, interval: '1m' },
    ]);

    mockFetchMarketTokenKline
      .mockResolvedValueOnce({
        points: [buildPoint(1060, 1), buildPoint(960), buildPoint(1020)],
        total: 3,
      })
      .mockResolvedValueOnce({
        points: [buildPoint(1200), buildPoint(1080), buildPoint(1060, 2)],
        total: 3,
      });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });

    expect(mockSliceRequest).toHaveBeenCalledWith('1m', 1000, 1120, {
      isNativeToken: false,
      minTimeSpanSeconds: 172_800,
    });
    expect(mockFetchMarketTokenKline).toHaveBeenNthCalledWith(1, {
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 900,
      timeTo: 1060,
    });
    expect(mockFetchMarketTokenKline).toHaveBeenNthCalledWith(2, {
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1060,
      timeTo: 1120,
    });
    expect(result?.total).toBe(3);
    expect(result?.points.map((point) => ({ t: point.t, c: point.c }))).toEqual(
      [
        { t: 1020, c: 1020 },
        { t: 1060, c: 2 },
        { t: 1080, c: 1080 },
      ],
    );
  });

  it('uses fallback data when sliced primary data has no points', async () => {
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 1000, to: 1120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockResolvedValueOnce({
      points: [],
      total: 0,
    });

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      kLineDataFallback: fallback,
    });

    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });
    expect(result?.points).toEqual([buildPoint(1020, 3)]);
  });

  it('uses fallback data when sliced primary data rejects', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fallback = jest.fn().mockResolvedValue({
      points: [buildPoint(1020, 3)],
      total: 1,
    });
    mockSliceRequest.mockReturnValue([
      { from: 1000, to: 1120, interval: '1m' },
    ]);
    mockFetchMarketTokenKline.mockRejectedValueOnce(
      new Error('primary failed'),
    );

    const result = await fetchTradingViewV2DataWithSlicing({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
      kLineDataFallback: fallback,
    });

    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '0x123',
      networkId: 'evm--1',
      interval: '1m',
      timeFrom: 1000,
      timeTo: 1120,
    });
    expect(result?.points).toEqual([buildPoint(1020, 3)]);
    consoleErrorSpy.mockRestore();
  });
});
