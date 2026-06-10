import { useEffect, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// DEBUG: detect runaway re-rendering of the chart components. Counts renders and
// logs the count once per ~1s window (only when >1 render happened, so a quiet
// component stays silent). A steady 30-60+/s means the component is re-rendering
// every frame (e.g. unmemoized subtree re-rendering on every price/orderbook
// tick), which churns native props and burns CPU. Logged as
// `market => chart => chartHost { event: 'renderRate', type: <tag>, method: 'N/Xms' }`.
export function useChartRenderRateLog(tag: string) {
  const count = useRef(0);
  const windowStart = useRef(Date.now());

  count.current += 1;

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - windowStart.current;
    if (elapsed >= 1000) {
      if (count.current > 1) {
        defaultLogger.market.chart.chartHost({
          platform: platformEnv.appPlatform ?? 'native',
          event: 'renderRate',
          type: tag,
          method: `${count.current}/${elapsed}ms`,
        });
      }
      count.current = 0;
      windowStart.current = now;
    }
  });
}
