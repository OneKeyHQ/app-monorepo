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
  referenceLineColor,
  showPreviousClose,
}: {
  chartComponents?: readonly ITradingViewNativeChartComponentNode[];
  dataProviderKey: string;
  latestPrice?: number;
  referenceLineColor: string;
  showPreviousClose: boolean;
}): readonly ITradingViewNativeChartLeafComponent[] {
  const finiteLatestPrice =
    latestPrice !== undefined && Number.isFinite(latestPrice)
      ? latestPrice
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
      !showPreviousClose || initialPrice === undefined
        ? undefined
        : {
            id: INITIAL_PRICE_REFERENCE_LINE_ID,
            props: {
              anchor: { price: initialPrice, type: 'price' },
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
  }, [chartComponents, initialPrice, referenceLineColor, showPreviousClose]);
}
