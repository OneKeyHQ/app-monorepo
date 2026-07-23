import type {
  IMarketTokenKLineDataPoint,
  IMarketTokenKLineResponse,
} from '@onekeyhq/shared/types/marketV2';

import { fetchMarketKLineData } from './fetchMarketKLineData';

type IFetchMarketTokenKline = (params: {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}) => Promise<IMarketTokenKLineResponse | null>;

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

function asRuntimeKLineResponse(points: unknown[]): IMarketTokenKLineResponse {
  return {
    points: points as IMarketTokenKLineDataPoint[],
    total: points.length,
  };
}

describe('fetchMarketKLineData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converts close-only Market data into numeric OHLC candles', async () => {
    mockFetchMarketTokenKline.mockResolvedValueOnce(
      asRuntimeKLineResponse([
        { c: '77.41', t: 1_784_056_920 },
        { c: '77.55', t: 1_784_060_520 },
      ]),
    );
    const fallback = jest.fn();

    const result = await fetchMarketKLineData({
      tokenAddress: '',
      networkId: 'sol--101',
      interval: '1H',
      timeFrom: 1_784_053_323,
      timeTo: 1_784_773_323,
      kLineDataFallback: fallback,
    });

    expect(result).toEqual({
      points: [
        {
          o: 77.41,
          h: 77.41,
          l: 77.41,
          c: 77.41,
          v: 0,
          t: 1_784_056_920,
        },
        {
          o: 77.41,
          h: 77.55,
          l: 77.41,
          c: 77.55,
          v: 0,
          t: 1_784_060_520,
        },
      ],
      total: 2,
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('normalizes numeric strings in complete Market candles', async () => {
    mockFetchMarketTokenKline.mockResolvedValueOnce(
      asRuntimeKLineResponse([
        {
          o: '1',
          h: '2',
          l: '0.5',
          c: '1.5',
          v: '3',
          t: '100',
        },
      ]),
    );

    await expect(
      fetchMarketKLineData({
        tokenAddress: '0x123',
        networkId: 'evm--1',
        interval: '1H',
        timeFrom: 0,
        timeTo: 200,
      }),
    ).resolves.toEqual({
      points: [{ o: 1, h: 2, l: 0.5, c: 1.5, v: 3, t: 100 }],
      total: 1,
    });
  });

  it('uses fallback data when Market points cannot be normalized', async () => {
    mockFetchMarketTokenKline.mockResolvedValueOnce(
      asRuntimeKLineResponse([{ c: 'not-a-number', t: 100 }]),
    );
    const fallbackPoint = {
      o: 10,
      h: 11,
      l: 9,
      c: 10.5,
      v: 12,
      t: 100,
    };
    const fallback = jest.fn().mockResolvedValue({
      points: [fallbackPoint],
      total: 1,
    });

    const result = await fetchMarketKLineData({
      tokenAddress: '',
      networkId: 'sol--101',
      interval: '1H',
      timeFrom: 0,
      timeTo: 200,
      kLineDataFallback: fallback,
    });

    expect(fallback).toHaveBeenCalledWith({
      tokenAddress: '',
      networkId: 'sol--101',
      interval: '1H',
      timeFrom: 0,
      timeTo: 200,
    });
    expect(result).toEqual({
      points: [fallbackPoint],
      total: 1,
    });
  });
});
