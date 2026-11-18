import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

export interface IUseFrozenTopHistoryDataResult {
  displayedHistoryData: IAccountHistoryTx[];
  // Feed list scroll threshold crossings into the freeze state machine.
  onAwayFromTopChange: (away: boolean) => void;
}
