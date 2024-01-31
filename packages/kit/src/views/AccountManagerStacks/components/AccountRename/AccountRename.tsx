import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { showRenameDialog } from '@onekeyhq/kit/src/components/RenameDialog';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

export function AccountRenameButton({
  indexedAccount,
  account,
}: {
  indexedAccount?: IDBIndexedAccount;
  account?: IDBAccount;
}) {
  const { serviceAccount } = backgroundApiProxy;
  const name = indexedAccount?.name || account?.name;
  if (name) {
    return (
      <ActionList
        title={name}
        renderTrigger={<ListItem.IconButton icon="DotHorOutline" />}
        items={[
          {
            icon: 'PencilOutline',
            label: 'Rename',
            onPress: async () => {
              showRenameDialog(name, {
                onSubmit: async (newName) => {
                  if (indexedAccount?.id && newName) {
                    await serviceAccount.setAccountName({
                      indexedAccountId: indexedAccount?.id,
                      name,
                    });
                  } else if (account?.id && newName) {
                    await serviceAccount.setAccountName({
                      accountId: account.id,
                      name,
                    });
                  }
                },
              });
            },
          },
        ]}
      />
    );
  }
}
