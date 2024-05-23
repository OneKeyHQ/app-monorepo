import type { ComponentProps } from 'react';

import { ListView } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

type IWalletListViewProps = {
  walletList: IDBWallet[] | undefined;
  onPick?: (item: IDBWallet) => void;
  ListEmptyComponent?: ComponentProps<typeof ListView>['ListEmptyComponent'];
  ListFooterComponent?: ComponentProps<typeof ListView>['ListFooterComponent'];
};

export function WalletListView({
  walletList,
  onPick,
  ListEmptyComponent,
  ListFooterComponent,
}: IWalletListViewProps) {
  return (
    <ListView
      data={walletList}
      renderItem={({ item }) => (
        <ListItem
          renderAvatar={<WalletAvatar wallet={item} />}
          title={item.name}
          drillIn
          onPress={() => onPick?.(item)}
        />
      )}
      estimatedItemSize="$10"
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
    />
  );
}
