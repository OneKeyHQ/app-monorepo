import { TxHistoryListView } from '@onekeyhq/kit/src/components/TxHistoryListView';
import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';

import { NativeHistoryList } from './NativeHistoryList';

import type { IHomeHistoryListViewProps } from './types';

const NativeHistoryListWithBrowser =
  withBrowserProvider<IHomeHistoryListViewProps>(NativeHistoryList);

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
    <NativeHistoryListWithBrowser key={props.frozenTopIdentityKey} {...props} />
  );
}
