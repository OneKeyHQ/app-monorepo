import { ActionList } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

import { AccountRemoveButton } from './AccountRemoveButton';
import { AccountRenameButton } from './AccountRenameButton';

export function AccountEditButton({
  indexedAccount,
  account,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
}) {
  const name = indexedAccount?.name || account?.name || '--';

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
          <AccountRemoveButton
            name={name}
            indexedAccount={indexedAccount}
            account={account}
            onClose={handleActionListClose}
          />
        </>
      )}
    />
  );
}
