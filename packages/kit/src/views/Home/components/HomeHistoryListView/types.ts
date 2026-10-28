import type { ITxHistoryListViewProps } from '@onekeyhq/kit/src/components/TxHistoryListView';

export type IHomeHistoryListViewProps = ITxHistoryListViewProps & {
  frozenTopEnabled: boolean;
  frozenTopIdentityKey: string;
  observeFrozenTop: boolean;
  onAwayFromTopChange: (away: boolean) => void;
};
