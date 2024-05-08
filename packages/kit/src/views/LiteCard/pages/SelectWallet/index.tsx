import { useRoute } from '@react-navigation/core';

import { Empty, Page, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletListView } from '@onekeyhq/kit/src/components/WalletListView';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  ELiteCardRoutes,
  ILiteCardParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { RouteProp } from '@react-navigation/core';

export default function SelectWalletPage() {
  const walletList = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets();
    const hdWalletList = wallets.filter((wallet) =>
      accountUtils.isHdWallet({ walletId: wallet.id }),
    );
    return hdWalletList;
  }, []).result;

  const route =
    useRoute<
      RouteProp<ILiteCardParamList, ELiteCardRoutes.LiteCardSelectWallet>
    >();

  const { onPick } = route.params;

  return (
    <Page>
      <WalletListView
        onPick={onPick}
        ListEmptyComponent={
          <Empty
            icon="SearchOutline"
            title="No Available Wallet"
            description="There is no app wallet available for backup"
          />
        }
        ListFooterComponent={
          walletList?.length ? (
            <SizableText size="$bodySm" color="$textSubdued" px="$5" mt="$5">
              Hardware wallets do not currently support backup to Lite, only App
              wallets will appear here.
            </SizableText>
          ) : null
        }
      />
    </Page>
  );
}
