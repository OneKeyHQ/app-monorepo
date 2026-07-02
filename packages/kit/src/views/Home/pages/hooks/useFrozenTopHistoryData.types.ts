import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

export interface IUseFrozenTopHistoryDataResult {
  displayedHistoryData: IAccountHistoryTx[];
  // Feed scroll-position crossings into the freeze state machine. Wired to a
  // `FrozenTopHistoryScrollObserver` mounted by the consumer ONLY inside a
  // collapsible-tab subtree; never called on non-tab pages.
  onAwayFromTopChange: (away: boolean) => void;
}

export interface IFrozenTopHistoryScrollObserverProps {
  enabled: boolean;
  onAwayFromTopChange: (away: boolean) => void;
}
