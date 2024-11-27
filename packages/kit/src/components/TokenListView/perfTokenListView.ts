import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';

export const perfTokenListView = perfUtils.createPerf({
  name: EPerformanceTimerLogNames.allNetwork__TokenListView,
  keepPrevDetail: true,
});
