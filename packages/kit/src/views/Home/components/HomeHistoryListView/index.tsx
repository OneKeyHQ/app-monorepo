import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';

import { FrozenTopHistoryScrollObserver } from '../../pages/hooks/useFrozenTopHistoryData';

import type { IHomeHistoryListViewProps } from './types';

export function HomeHistoryListView({
  frozenTopEnabled,
  frozenTopIdentityKey: _frozenTopIdentityKey,
  observeFrozenTop,
  onAwayFromTopChange,
  ...props
}: IHomeHistoryListViewProps) {
  return (
    <>
      {observeFrozenTop ? (
        <FrozenTopHistoryScrollObserver
          enabled={frozenTopEnabled}
          onAwayFromTopChange={onAwayFromTopChange}
        />
      ) : null}
      <TxHistoryListView {...props} />
    </>
  );
}
