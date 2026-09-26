import { Suspense, lazy } from 'react';

import { HistoryLoadingView } from '@onekeyhq/kit/src/components/Loading';
import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import type { IHomeHistoryListViewProps } from './types';

const NativeHistoryListWithBrowser = lazy(() =>
  import('./NativeHistoryList').then(({ NativeHistoryList }) => ({
    default: withBrowserProvider<IHomeHistoryListViewProps>(NativeHistoryList),
  })),
);

export function HomeHistoryListView(props: IHomeHistoryListViewProps) {
  if (props.plainMode || !props.observeFrozenTop) {
    const {
      frozenTopEnabled: _enabled,
      frozenTopIdentityKey: _identity,
      observeFrozenTop: _observe,
      onAwayFromTopChange: _onAway,
      ...listProps
    } = props;
    return <TxHistoryListView {...listProps} />;
  }
  return (
    <Suspense fallback={<HistoryLoadingView />}>
      <NativeHistoryListWithBrowser
        key={props.frozenTopIdentityKey}
        {...props}
      />
    </Suspense>
  );
}
