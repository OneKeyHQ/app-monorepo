import { useMemo } from 'react';

import { TradingViewNative } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import type { ITradingViewNativeProps } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { usePerpsNativeChartLines } from '../hooks/usePerpsNativeChartLines';
import { usePerpsNativeChartMarks } from '../hooks/usePerpsNativeChartMarks';
import { usePerpsNativeChartMetadata } from '../hooks/usePerpsNativeChartMetadata';

export function PerpsNativeChart({
  enableTradingUi = false,
  ...props
}: ITradingViewNativeProps & { enableTradingUi?: boolean }) {
  const { chartComponents: lines, onReferenceLineAction } =
    usePerpsNativeChartLines(
      enableTradingUi,
      props.nativeChartDisplayMode === 'marketDetail',
    );
  const marks = usePerpsNativeChartMarks(props.active);
  const metadata = usePerpsNativeChartMetadata();
  const chartComponents = useMemo(() => [...lines, ...marks], [lines, marks]);

  return (
    <TradingViewNative
      {...props}
      {...metadata}
      chartComponents={chartComponents}
      onReferenceLineAction={
        enableTradingUi ? onReferenceLineAction : undefined
      }
    />
  );
}
