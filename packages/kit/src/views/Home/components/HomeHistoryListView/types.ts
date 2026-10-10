import type { ComponentProps } from 'react';

import type { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';

export type IHomeHistoryListViewProps = ComponentProps<
  typeof TxHistoryListView
> & {
  frozenTopEnabled: boolean;
  frozenTopIdentityKey: string;
  observeFrozenTop: boolean;
  onAwayFromTopChange: (away: boolean) => void;
};
