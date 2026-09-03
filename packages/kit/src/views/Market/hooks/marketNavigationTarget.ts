import type {
  IMarketSelectedTab,
  IMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export interface IMarketNavigationTarget {
  tab?: IMarketSelectedTab;
  spotCategory?: string;
  perpsCategory?: string;
}

export function isMarketNavigationTargetApplied(
  selection: IMarketSelectedTabAtom,
  target: IMarketNavigationTarget,
) {
  return Boolean(
    (!target.tab || selection.tab === target.tab) &&
    (!target.spotCategory ||
      selection.selectedSpotCategory === target.spotCategory) &&
    (!target.perpsCategory ||
      selection.selectedPerpsCategory === target.perpsCategory),
  );
}
