import { ActionList } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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
  const { config } = useAccountSelectorContextData();
  if (!config) {
    return null;
  }
  return (
    <ActionList
      title={name}
      renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
      renderItems={({ handleActionListClose }) => (
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
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
        </AccountSelectorProviderMirror>
      )}
    />
  );
}
