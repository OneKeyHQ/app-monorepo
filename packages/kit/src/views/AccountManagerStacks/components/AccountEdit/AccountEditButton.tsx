import { ActionList } from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AccountExportPrivateKeyButton } from './AccountExportPrivateKeyButton';
import { AccountRemoveButton } from './AccountRemoveButton';
import { AccountRenameButton } from './AccountRenameButton';

export function AccountEditButton({
  indexedAccount,
  account,
  wallet,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
  wallet?: IDBWallet;
}) {
  const name = indexedAccount?.name || account?.name || '--';
  // const { config } = useAccountSelectorContextData();
  // if (!config) {
  //   return null;
  // }
  const showExportPrivateKeys =
    wallet?.id &&
    (accountUtils.isHdWallet({ walletId: wallet?.id }) ||
      accountUtils.isImportedWallet({ walletId: wallet?.id }));
  const showRemoveButton = !indexedAccount || platformEnv.isDev;

  return (
    <ActionList
      title={name}
      renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
      renderItems={({ handleActionListClose }) => (
        <>
          <AccountRenameButton
            name={name}
            indexedAccount={indexedAccount}
            account={account}
            onClose={handleActionListClose}
          />
          {showExportPrivateKeys ? (
            <AccountExportPrivateKeyButton
              accountName={name}
              indexedAccount={indexedAccount}
              account={account}
              onClose={handleActionListClose}
            />
          ) : null}
          {showRemoveButton ? (
            <AccountRemoveButton
              name={name}
              indexedAccount={indexedAccount}
              account={account}
              onClose={handleActionListClose}
            />
          ) : null}
        </>
      )}
    />
  );
}
