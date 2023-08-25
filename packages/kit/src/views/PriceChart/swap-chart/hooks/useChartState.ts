import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { wait } from '@onekeyfe/hd-core';

import type { Token } from '@onekeyhq/engine/src/types/token';

import { useInterval } from '../../../../hooks';
import { type MarketApiData, fetchChartData } from '../../chartService';
import { TIMEOPTIONS, TIMEOPTIONS_VALUE } from '../../TimeControl';

const getHours = () => String(Math.ceil(Date.now() / (1000 * 60 * 60)));

function useHours() {
  const [state, setState] = useState(getHours());
  const cb = useCallback(() => setState(getHours()), []);
  useInterval(cb, 1000 * 60 * 30);
  return state;
}

type IFetchDataParams = {
  newTimeValue: string;
  networkId: string;
  contractAdress: string;
};

type UseChartStateParams = {
  fromToken: Token;
  toToken: Token;
};

type UseChartStateResult = {
  data: MarketApiData[];
  isFetching: boolean;
  selectedTimeIndex: number;
  refreshDataOnTimeChange: (newTimeValue: string) => void;
};

export const useChartState = ({
  fromToken,
  toToken,
}: UseChartStateParams): UseChartStateResult => {
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const hours = useHours();

  const dataMap = useRef<
    Record<string, Record<string, Record<string, MarketApiData[][]>>>
  >({});

  const points = '100';

  const fetchData = useCallback(
    async (params: IFetchDataParams) => {
      const { contractAdress, newTimeValue, networkId } = params;
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      const cacheData =
        dataMap.current?.[networkId]?.[contractAdress]?.[hours]?.[newTimeIndex];
      if (!cacheData) {
        let newData: MarketApiData[] = [];
        try {
          setPendingCount((v) => v + 1);
          newData = await fetchChartData({
            contract: contractAdress,
            networkId,
            days: TIMEOPTIONS_VALUE[newTimeIndex],
            points,
            vs_currency: 'usd',
          });
          await wait(50);
          if (newData?.length) {
            if (!dataMap.current?.[networkId]) {
              dataMap.current[networkId] = {};
            }
            if (!dataMap.current[networkId][contractAdress]) {
              dataMap.current[networkId][contractAdress] = {};
            }

            if (!dataMap.current[networkId][contractAdress][hours]) {
              dataMap.current[networkId][contractAdress][hours] = [];
            }
            dataMap.current[networkId][contractAdress][hours][newTimeIndex] =
              newData;
          }
        } finally {
          setPendingCount((v) => v - 1);
        }
      }
    },
    [dataMap, hours],
  );

  useEffect(() => {
    fetchData({
      newTimeValue: TIMEOPTIONS[selectedTimeIndex],
      networkId: toToken.networkId,
      contractAdress: toToken.tokenIdOnNetwork,
    });
  }, [toToken, fetchData, selectedTimeIndex]);

  useEffect(() => {
    fetchData({
      newTimeValue: TIMEOPTIONS[selectedTimeIndex],
      networkId: fromToken.networkId,
      contractAdress: fromToken.tokenIdOnNetwork,
    });
  }, [fromToken, fetchData, selectedTimeIndex]);

  const refreshDataOnTimeChange = useCallback(
    async (newTimeValue: string) => {
      const newTimeIndex = TIMEOPTIONS.indexOf(newTimeValue);
      const a = fetchData({
        newTimeValue,
        networkId: fromToken.networkId,
        contractAdress: fromToken.tokenIdOnNetwork,
      });
      const b = fetchData({
        newTimeValue,
        networkId: toToken.networkId,
        contractAdress: toToken.tokenIdOnNetwork,
      });
      await Promise.all([a, b]);
      setSelectedTimeIndex(newTimeIndex);
    },
    [fromToken, toToken, fetchData],
  );

  const data = useMemo(() => {
    const fromData =
      dataMap.current[fromToken.networkId]?.[fromToken.tokenIdOnNetwork]?.[
        hours
      ]?.[selectedTimeIndex];
    const toData =
      dataMap.current[toToken.networkId]?.[toToken.tokenIdOnNetwork]?.[hours]?.[
        selectedTimeIndex
      ];

    if (fromData && toData) {
      const len = Math.min(fromData.length, toData.length);
      const result = fromData.slice(0, len - 1).map((item, i) => {
        const timestamp = item[0];
        const fromValue = item[1];
        const toValue = toData[i][1];
        const value = fromValue / toValue;
        return [timestamp, value];
      });
      return result as MarketApiData[];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toToken, fromToken, selectedTimeIndex, pendingCount, hours]);

  return useMemo(
    () => ({
      data,
      isFetching: pendingCount > 0,
      selectedTimeIndex,
      refreshDataOnTimeChange,
    }),
    [data, pendingCount, selectedTimeIndex, refreshDataOnTimeChange],
  );
};
