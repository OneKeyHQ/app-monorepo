import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { sliceRequest } from '../sliceRequest';

interface ITradingViewV2Params {
  tokenAddress: string;
  networkId: string;
  interval: string;
  timeFrom: number;
  timeTo: number;
}

export async function fetchTradingViewV2Data({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  try {
    const data = await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline(
      {
        tokenAddress,
        networkId,
        interval,
        timeFrom,
        timeTo,
      },
    );

    return data;
  } catch (error) {
    console.error('Failed to fetch kine data:', error);
    return null;
  }
}

export async function fetchTradingViewV2DataWithSlicing({
  tokenAddress,
  networkId,
  interval,
  timeFrom,
  timeTo,
}: ITradingViewV2Params): Promise<IMarketTokenKLineResponse | null> {
  try {
    const slices = sliceRequest(interval, timeFrom, timeTo);

    const dataPromises = slices.map((slice) =>
      backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
        tokenAddress,
        networkId,
        interval: slice.interval,
        timeFrom: slice.from,
        timeTo: slice.to,
      }),
    );

    const dataResults = await Promise.all(dataPromises);

    let mergedData: IMarketTokenKLineResponse | null = null;

    for (const data of dataResults) {
      if (data) {
        if (!mergedData) {
          mergedData = { ...data };
        } else if (data.points && mergedData.points) {
          // Merge points data arrays
          mergedData.points = [...mergedData.points, ...data.points];
          mergedData.total = mergedData.points.length;
        }
      }
    }

    return mergedData;
  } catch (error) {
    console.error('Failed to fetch sliced kine data:', error);
    return null;
  }
}
