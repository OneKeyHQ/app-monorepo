import type { ComponentProps } from 'react';

import { ListView } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

type IWalletListViewProps = {
  onPick?: (item: IDBWallet) => void;
  ListEmptyComponent?: ComponentProps<typeof ListView>['ListEmptyComponent'];
  ListFooterComponent?: ComponentProps<typeof ListView>['ListFooterComponent'];
};

export function WalletListView({
  onPick,
  ListEmptyComponent,
  ListFooterComponent,
}: IWalletListViewProps) {
  const walletList = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets();
    const hdWalletList = wallets.filter((wallet) =>
      accountUtils.isHdWallet({ walletId: wallet.id }),
    );
    return hdWalletList;
  }, []).result;

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
