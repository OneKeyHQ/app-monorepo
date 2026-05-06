import { isPerfMonitorEnabled } from '@onekeyhq/shared/src/performance/enabled';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

type ITokenSelectorPerfLayout = 'desktop' | 'mobile';
type ITokenSelectorPerfPhase = 'perp-sort' | 'spot-sort' | 'active-tab';

type ITokenSelectorPerfDetail = {
  layout: ITokenSelectorPerfLayout;
  phase: ITokenSelectorPerfPhase;
  activeTab?: string;
  sortField?: string;
  sortDirection?: string;
  perpCount?: number;
  spotCount?: number;
  resultCount?: number;
  searchQueryLength?: number;
  dynamicTabCount?: number;
  volumeFilteredCount?: number;
};

const TOKEN_SELECTOR_PERF_MARK_NAME = 'Perp:TokenSelector:phase';

function getNow() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function startTokenSelectorPerfMeasure() {
  if (!isPerfMonitorEnabled()) {
    return undefined;
  }
  return getNow();
}

function markTokenSelectorPerfMeasure(
  startTime: number | undefined,
  detail: ITokenSelectorPerfDetail,
) {
  if (typeof startTime !== 'number') {
    return;
  }

  const durationMs = Math.max(
    0,
    Math.round((getNow() - startTime) * 100) / 100,
  );

  perfMark(TOKEN_SELECTOR_PERF_MARK_NAME, {
    ...detail,
    durationMs,
  });
}

export {
  TOKEN_SELECTOR_PERF_MARK_NAME,
  markTokenSelectorPerfMeasure,
  startTokenSelectorPerfMeasure,
};
export type { ITokenSelectorPerfDetail };
