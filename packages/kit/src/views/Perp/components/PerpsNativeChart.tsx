import { useMemo } from 'react';

import { TradingViewNative } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { usePerpsNativeChartLines } from '../hooks/usePerpsNativeChartLines';
import { usePerpsNativeChartMarks } from '../hooks/usePerpsNativeChartMarks';
import { usePerpsNativeChartMetadata } from '../hooks/usePerpsNativeChartMetadata';

export function usePerpsNativeChartLayers({
  enableTradingUi,
  active,
  compactLabels = false,
}: {
  enableTradingUi: boolean;
  active?: boolean;
  compactLabels?: boolean;
}) {
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(enableTradingUi, compactLabels);
  const marks = usePerpsNativeChartMarks(active);
  const metadata = usePerpsNativeChartMetadata();
  return { lines, marks, metadata, onReferenceLineAction };
}

export function PerpsNativeChart(props: ITradingViewNativeProps) {
  const { lines, marks, metadata } = usePerpsNativeChartLayers({
    enableTradingUi: false,
    active: props.active,
    compactLabels: props.nativeChartDisplayMode === 'marketDetail',
  });
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);

  return (
    <TradingViewNative
      {...props}
      {...metadata}
      chartComponents={chartComponents}
      onReferenceLineAction={undefined}
      isPricePrecisionLoading={metadata.priceDecimalPlaces === undefined}
    />
  );
}
