import { Button } from '@onekeyhq/components';
import type { IDBWalletId } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';

export function AccountSelectorCreateAddressButton({
  num,
  children,
  selectAfterCreate,
  account,
}: {
  num: number;
  children?: React.ReactNode;
  selectAfterCreate?: boolean;
  account: {
    walletId: IDBWalletId | undefined;
    networkId: string | undefined;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
  };
}) {
  const { serviceAccount } = backgroundApiProxy;

  const actions = useAccountSelectorActions();

  return (
    <Button
      size="small"
      borderWidth={0}
      variant="tertiary"
      onPress={async () => {
        if (
          !account ||
          !account.walletId ||
          !account.networkId ||
          !account.indexedAccountId ||
          !account.deriveType
        ) {
          return;
        }
        const c = await serviceAccount.addHDOrHWAccounts({
          walletId: account?.walletId,
          networkId: account?.networkId,
          indexedAccountId: account?.indexedAccountId,
          deriveType: account?.deriveType,
        });
        console.log(c);
        // await refreshCurrentAccount();
        actions.current.refresh({ num });

        if (selectAfterCreate) {
          await actions.current.updateSelectedAccountForHdOrHwAccount({
            num,
            walletId: c?.walletId,
            indexedAccountId: c?.indexedAccountId,
          });
        }
      }}
    >
      {children || 'Create Address'}
    </Button>
  );
}
