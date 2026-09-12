import { useMemo } from 'react';

import { TRADING_VIEW_PREVIOUS_CLOSE_LABEL } from '../constants';

import { flattenTradingViewNativeChartComponentTree } from './utils/chartComponentTree';

import type {
  ITradingViewNativeChartComponentNode,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeReferenceLineComponent,
} from './types';

const EMPTY_CHART_COMPONENTS: readonly ITradingViewNativeChartComponentNode[] =
  [];
const PREVIOUS_CLOSE_REFERENCE_LINE_ID = 'system.previousCloseReferenceLine';

export function useTradingViewNativeChartComponents({
  chartComponents = EMPTY_CHART_COMPONENTS,
  previousClose,
  referenceLineColor,
  showPreviousClose,
}: {
  chartComponents?: readonly ITradingViewNativeChartComponentNode[];
  // Reported previous session close. The line carries the `Prev close` label,
  // so it is only drawn from this figure: no live price stands in for it.
  previousClose?: number;
  referenceLineColor: string;
  showPreviousClose: boolean;
}): readonly ITradingViewNativeChartLeafComponent[] {
  const finitePreviousClose =
    previousClose !== undefined && Number.isFinite(previousClose)
      ? previousClose
      : undefined;

  return useMemo(() => {
    const previousCloseReferenceLine:
      | ITradingViewNativeReferenceLineComponent
      | undefined =
      !showPreviousClose || finitePreviousClose === undefined
        ? undefined
        : {
            id: PREVIOUS_CLOSE_REFERENCE_LINE_ID,
            props: {
              anchor: { price: finitePreviousClose, type: 'price' },
              color: referenceLineColor,
              interactive: false,
              style: 'dashed',
              title: TRADING_VIEW_PREVIOUS_CLOSE_LABEL,
            },
            type: 'referenceLine',
          };

    return flattenTradingViewNativeChartComponentTree([
      ...(previousCloseReferenceLine ? [previousCloseReferenceLine] : []),
      ...chartComponents,
    ]);
  }, [
    chartComponents,
    finitePreviousClose,
    referenceLineColor,
    showPreviousClose,
  ]);
}
