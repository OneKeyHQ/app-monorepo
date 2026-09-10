import { useEffect, useMemo, useState } from 'react';

import { TRADING_VIEW_PREVIOUS_CLOSE_LABEL } from '../constants';

import { flattenTradingViewNativeChartComponentTree } from './utils/chartComponentTree';

import type {
  ITradingViewNativeChartComponentNode,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeReferenceLineComponent,
} from './types';

const EMPTY_CHART_COMPONENTS: readonly ITradingViewNativeChartComponentNode[] =
  [];
const INITIAL_PRICE_REFERENCE_LINE_ID = 'system.initialPriceReferenceLine';

interface ICapturedInitialPrice {
  dataProviderKey: string;
  price: number | null;
}

export function useTradingViewNativeChartComponents({
  chartComponents = EMPTY_CHART_COMPONENTS,
  dataProviderKey,
  latestPrice,
  previousClose,
  referenceLineColor,
  showPreviousClose,
}: {
  chartComponents?: readonly ITradingViewNativeChartComponentNode[];
  dataProviderKey: string;
  latestPrice?: number;
  // Reported previous session close. Takes precedence over the captured first
  // price, which only stands in while no real figure is available.
  previousClose?: number;
  referenceLineColor: string;
  showPreviousClose: boolean;
}): readonly ITradingViewNativeChartLeafComponent[] {
  const finiteLatestPrice =
    latestPrice !== undefined && Number.isFinite(latestPrice)
      ? latestPrice
      : undefined;
  const finitePreviousClose =
    previousClose !== undefined && Number.isFinite(previousClose)
      ? previousClose
      : undefined;
  const [capturedInitialPrice, setCapturedInitialPrice] =
    useState<ICapturedInitialPrice>(() => ({
      dataProviderKey,
      price: finiteLatestPrice ?? null,
    }));
  const currentCapturedPrice =
    capturedInitialPrice.dataProviderKey === dataProviderKey
      ? capturedInitialPrice.price
      : null;
  const isCurrentSourceCaptured = currentCapturedPrice !== null;
  const initialPrice = currentCapturedPrice ?? finiteLatestPrice;
  const referencePrice = finitePreviousClose ?? initialPrice;
  const uncapturedPrice = isCurrentSourceCaptured
    ? undefined
    : finiteLatestPrice;

  useEffect(() => {
    if (isCurrentSourceCaptured) {
      return;
    }
    setCapturedInitialPrice((currentPrice) =>
      currentPrice.dataProviderKey === dataProviderKey &&
      (currentPrice.price !== null || uncapturedPrice === undefined)
        ? currentPrice
        : { dataProviderKey, price: uncapturedPrice ?? null },
    );
  }, [dataProviderKey, isCurrentSourceCaptured, uncapturedPrice]);

  return useMemo(() => {
    const initialPriceReferenceLine:
      | ITradingViewNativeReferenceLineComponent
      | undefined =
      !showPreviousClose || referencePrice === undefined
        ? undefined
        : {
            id: INITIAL_PRICE_REFERENCE_LINE_ID,
            props: {
              anchor: { price: referencePrice, type: 'price' },
              color: referenceLineColor,
              interactive: false,
              style: 'dashed',
              title: TRADING_VIEW_PREVIOUS_CLOSE_LABEL,
            },
            type: 'referenceLine',
          };

    return flattenTradingViewNativeChartComponentTree([
      ...(initialPriceReferenceLine ? [initialPriceReferenceLine] : []),
      ...chartComponents,
    ]);
  }, [chartComponents, referencePrice, referenceLineColor, showPreviousClose]);
}
